# Prototype Coverage — Billing System (PRD V2)

This file maps every requirement in **`Billing System PRD v2.docx`** to the clickable prototype in `prototype/`, so anyone can audit whether the prototype covers V2.

- **References** use the PRD's own section numbers and V2 page numbers (`§6.2 p7`).
- **Question IDs** (`Q-###`, `C-###`) are entries in `PRD_CLARIFICATION_QUESTIONS.md`. **Change IDs** (`CH-##`) are in `PRD_V1_TO_V2_CHANGELOG.md`.
- **Workflow IDs** (`W1`–`W8`) are the core workflows in `PROJECT_MEMORY.md` §7. **Prototype assumptions** (`A-P##`) are listed in section 5.
- Migrated from V1 on 2026-09-16. Section 3 lists what changed in the prototype and why.
- **Two environments** (added 2026-09-17): **Demo Data** and **Fresh System**, in the same prototype. Sections 8 and 9 describe them.
- **Product, plus review notes** (2026-09-17): the **Billing System** screens contain only product content. Assumptions, client questions and prototype notes are a thin **Review Notes** annotation layer — one small control and numbered markers. Section 10 describes it. Where the matrix below says “review note”, the information is shown there, not in the application.

**The prototype is not the product.** Plain HTML, CSS and JavaScript with in-memory demo data: no backend, no persistence (a refresh resets everything), no real authentication, no real integrations. **Open it:** double-click `prototype/index.html` (see `prototype/README.md`).

**Status legend**

| Status | Meaning |
|---|---|
| **Implemented** | Works end to end in the prototype, as PRD V2 states it. |
| **Partially Implemented** | Represented, but simplified, or an external system is stood in for by a prototype simulator (Alt + Shift + S). The note says what is missing. |
| **Not Implemented** | Specified by V2 but not demonstrated. |
| **Needs Clarification** | V2 names or implies it without defining the behaviour. The application behaves according to a prototype assumption; a review note states the assumption and the linked question, which must be answered first. |
| **Not Applicable** | Cannot be meaningfully demonstrated in a local prototype (real infrastructure), or is documentation rather than behaviour. |

**Workflows:** W1 Onboarding & setup · W2 EMR integration · W3 Patient & case · W4 Charge → claim (incl. release buckets) · W5 Updated note · W6 Hold resolution · W7 Payment posting · W8 Escalation.

---

## 1. Requirement → prototype matrix

### Chapter 1 — Account setup & provisioning

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §1.1 p2 | Admin | Practice onboarding: legal name, DBA, billing address, Tax ID (EIN/SSN), taxonomy, Group NPI | Admin → Practices & locations | New practice (System Admin); edit practice; NPI, EIN/SSN and taxonomy validated | W1 | Implemented | Tax-ID type and DBA have no V2 column (Q-022) |
| §1.2 p2 | Admin | At least one primary location at account creation | New practice dialog | Practice and primary location created in one form; last active/primary location cannot be deactivated | W1 | Implemented | |
| §1.2 p2 | Admin | Additional locations: name, rendering address, NPI | Practices & locations → Locations | Add, edit, deactivate, set primary; default POS per location | W1 | Implemented | |
| §1.3 p2 | Admin / EMR | Clinicians are not users; profiles created manually or from the EMR | Admin → Providers; Simulators → EMR push → "clinician billing has never seen" | Draft provider from the first finalized note, completed in Exceptions → Incomplete profiles | W4 | Needs Clarification | Auto-created clinician treated as a draft (A-P10, Q-006) |
| §1.3 p2 | Access | Organization Admin and Practice Admin | Sign-in role picker | Both usable; differ by practices, modules and limits | — | Needs Clarification | Organization Admin permissions assumed (A-P21, C-002) |
| §1.3 p2 | Access | Scope granted per practice and/or location | "Company" switcher; Billing Viewer role (Bay Ridge only) | Switching practice rescopes every list; location-limited user sees Bay Ridge visits and their patients | — | Implemented | Patient visibility by visit location (A-P39, Q-031) |
| §1.4 p3 | Access | Edit / View / Hidden per section | Admin → Roles & permissions; any screen as Billing Viewer | Module-level Edit/View/Hidden with Delete flag; View hides actions; Hidden removes the section | — | Partially Implemented | Field-level Hidden not shown; conflicts with §10.2 role model (C-001) |

### Chapter 2 — EMR integration

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §2.1 p3 | Integration | Integration per facility, never global | Admin → EMR integration | Link and election per location | W2 | Implemented | |
| §2.2 p3 | Integration | Domain Admin request; 1:1 Unique Location ID | EMR integration (as Domain Admin) | Request → Requested → Approve & link → Linked | W2 | Needs Clarification | Approver assumed (A-P22, Q-029) |
| §2.3 p3 | Integration | Integrated vs EMR-only; EMR-only payloads blocked | EMR integration; simulator "EMR-only location" | Switch election with a consequence confirm; blocked payloads in the payload log | W2 | Implemented | Effect on existing data open (Q-030) |
| §2.3 p3 | Integration | Integrated locations send sessions, charges, charts, cases, providers | Simulator "New patient from the EMR" | Patient, Default case, coverage and visit created from one payload | W2, W4 | Partially Implemented | Simulated EMR; payload contract unknown (Q-004) |

### Chapter 3 — Core metadata & hierarchies

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §3.1 p4 | All | Organization → Practice → Location → Provider → Patient → Case → Session/Claim → Charge line | Company switcher, chart case switcher, visit detail, claim detail | Navigating down the hierarchy | — | Needs Clarification | V2 puts location and providers on the visit, not above the case (C-014) |
| §3.2 p4 | Patient | Case insurances: primary/secondary/tertiary, subscriber, member ID, group, dates | Chart → Coverage | Add/edit/remove per rank; subscriber fields; WC employer; PIP/WC claim number | W3 | Partially Implemented | Effective/termination dates not in V2 data model (C-007) |
| §3.2 p4 | Patient | Authorizations: number, dates, approved, used, remaining | Chart → Authorizations | Add/delete; Active / Last visit / Exhausted / Expired; saving re-checks pended visits and Authorization holds | W3, W6 | Needs Clarification | Consumption rule assumed (A-P06, Q-009) |
| §3.2 p4 | Patient | ICD-10 primary + secondary, up to 12 | Chart → Diagnoses | Add, reorder (position = pointer), remove; max 12 | W3 | Implemented | |
| §3.2 p4 | Admin / Patient | Referring physician; name, type and NPI required | Admin → Referring physicians; case form | Directory CRUD; dummy NPIs flagged; required on the case | W1, W3 | Implemented | "Type" now defined by V2 (§10.3 p18); required vs optional Box 17 open (C-006) |
| §3.3 p4 | Setup | Billing / rendering / referring / supervising roles | Visit detail (billing + rendering); referring directory (DN/DQ) | Billing and rendering provider chosen per visit; supervising recorded as a DQ referrer | W3, W4 | Needs Clarification | Referring and supervising on one claim not possible (Q-078) |
| §3.4 p4 | Setup | Pricing per unit or per code; payer schedule overrides default | Admin → Fee schedules (price lookup); visit charge lines | Billed price rows; lookup shows source; unbilled visits repriced on change | W1, W4 | Partially Implemented | Per-code (flat) pricing not modelled (Q-020) |

### Chapter 4 — Ingestion & pre-scrubbing

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §4.1 p5 | Charges | Cycle starts on EMR push or manual creation | Simulators → EMR push; Charges → New charge | Both run the same intake checks; manual entry requires location, billing and rendering provider | W4 | Implemented | EMR side simulated |
| §4.2 p5 | Charges | New Record ID → pipeline | Simulator "Clean session" | Visit lands in Charge review | W4 | Implemented | |
| §4.2 p5 | Charges | Existing ID not submitted → replace; old record inactive and viewable | Simulator "Re-send a note still in review"; Charges → Inactive records | Old record inactive with link to replacement; its held claims cancelled | W4 | Implemented | |
| §4.2 p5 | Charges | Existing ID submitted or under scrubbing → Updated queue | Simulator "Re-send a note already submitted"; Charges → Updated | Update waits with a line-by-line diff | W5 | Needs Clarification | "Under scrubbing" vs "already submitted" (C-012) |
| §4.3 p5 | Exceptions | Unknown provider/insurance → draft profile; session quarantined | Exceptions → Incomplete profiles | Complete profile (insurance needs a class) → sessions released | W4 | Needs Clarification | Auto-release assumed (A-P10, Q-005) |
| §4.4 p5 | Exceptions | Patient: dummy phone, ZIP/state, character limits | Exceptions (Patient) | Fix phone/address or truncate/edit name → visit moves on | W4 | Needs Clarification | Limits are placeholders (A-P09, Q-007) |
| §4.4 p6 | Exceptions | Case: missing injury date / employment status / subscriber; dummy referring NPI | Exceptions (Case) | Complete case fields, correct NPI or choose another referrer | W4 | Partially Implemented | Employment status has no V2 column (Q-008) |
| §4.4 p6 | Exceptions | Session: field length; missing/dummy rendering NPI | Exceptions (Session) | Enter the provider's NPI | W4 | Implemented | |
| §4.4 p6 | Exceptions | Charge: new CPT at $0.00; missing fee mapping | Exceptions (Charge) | Set a default fee and/or a payer billed price | W4 | Implemented | |
| §4.4 p6 | Exceptions | Payment: unmapped remittance; ERA discrepancies | Exceptions (Payment) | Map line to a claim or map the adjustment code (CO-253) → posts | W7 | Implemented | |

### Chapter 5 — Queues & batch operations

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §5.1 p6 | Charges | Ingestion queue of charges ready for validation | Charges → Ready to submit | Released visits wait here | W4 | Implemented | |
| §5.1 p6 | Charges | Single, bulk and scheduled submission | Ready to submit; Admin → Submission & automation | Submit, Submit selected, Run scheduled job now | W4 | Partially Implemented | Scheduled job runs on demand (A-P32, Q-041) |
| §5.2 p6 | Charges | Updated queue: Inactivate | Updated → Review update | Update archived; claim unchanged | W5 | Implemented | |
| §5.2 p6 | Charges / Claims | Updated queue: corrected claim (Box 22 original ref + 7/8) | Updated → Review update; claim menu | Frequency-7 replacement or frequency-8 void; Box 22 shows code and reference | W5 | Needs Clarification | Source of original reference (A-P19, Q-019); void effect on money (Q-044) |
| §5.2 p6 | Charges | Updated queue: Submit anyway | Updated → Review update | Duplicate warning; fresh claim created | W5 | Needs Clarification | Conflicts with one claim per payer (C-004) |

### Chapter 6 — Coding engine & scrubbing

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §6.1 p7 | Billing rules | Replace rule | Admin → Coding rules; scrub results | Medicare 97014 → G0283 at scrub | W4 | Implemented | |
| §6.1 p7 | Billing rules | Drop rule | Coding rules; scrub results | Default rule drops 97010 | W4 | Implemented | |
| §6.1 p7 | Billing rules | Payer rules override default; run on fresh, resubmitted, corrected claims | Coding rules → Test the rules | Tester shows which rule wins | W4 | Needs Clarification | Primary claims only (A-P12); "posting grids" undefined (Q-013) |
| §6.2 p7 | Claims | Data integrity → Missing Data hold | Claims → Holds | Kevin O'Brien lacks a group number; fix coverage → auto-resubmit. Now also checks the visit has a location and billing provider | W4, W6 | Implemented | |
| §6.2 p7 | Claims | Authorization → Authorization Hold (effective rule) | Holds | Maria Gonzalez; add authorization → held claim resubmits, pended visits return | W4, W6 | Implemented | Requirement read from the insurer's effective rule (CH-02) |
| §6.2 p7 | Claims | Credentialing → Credentialing Hold | Holds | James Whitaker (pending with UHC); set enrollment Active → resubmits | W4, W6 | Needs Clarification | Enrollment list is a prototype addition (A-P08, Q-010) |
| §6.2 p7 | Claims | Payer rules (unit caps, Boxes 10b/14/17) → Payer Rule Hold | Holds | Robert Chen, 97110 × 7 > max 6 | W4, W6 | Needs Clarification | Unit caps have no V2 column (A-P18, Q-011) |
| §6.2 p7 | Claims | AI coding quality → Coding Issue Hold | Holds | Eleanor Fitzgerald, 97750 on R26.89 | W4, W6 | Partially Implemented | Rule-based stand-in (A-P33, Q-014) |
| **§6.2 p7** *(changed, CH-01)* | Claims | **Manual release required: insurance hold → assigned release bucket** | Claims → Release buckets; Claims → Holds ("Release bucket" reason); claim detail | Clean claims for held insurers stop in their bucket; **Release** (one) or **Release all** (bucket); release recorded with user and time; view-only roles see no release buttons | W4 | Needs Clarification | Who may release and whether release re-checks (A-P38, Q-076); bucketed claims never auto-resubmit (A-P37, C-013) |

### Chapter 7 — Lifecycle & clearinghouse analytics

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §7.1 p8 | Claims | Fresh/Updated → Scrubbing → Hold → Submitted | Submission animation; Claims tabs | Checks tick; claims land in Holds, Release buckets or Submitted | W4 | Needs Clarification | Unified status model assumed (A-P02, A-P03, C-003) |
| §7.1 p8 | Claims | Hold auto-resubmits when the reason is resolved | Any save that fixes a cause | Toast reports what happened next; release buckets excluded | W6 | Needs Clarification | Trigger assumed (A-P05, Q-012); conflict with buckets (C-013) |
| §7.1 p8 | Claims | Compiled into EDI 837 or PDF print queue, sent to Waystar | Claim → 837P; CMS-1500 → Print | 837P preview; print view | W4 | Partially Implemented | No real transmission (Q-015) |
| §7.2 p8 | Claims | Daily batch: attempted, actual, held by failure code, live rejections | Claims → Daily batches; dashboard | Pick a day; runs with claim drawer; held counts include release buckets | W4 | Needs Clarification | Whether bucketed claims count as held (C-013); day boundary (Q-042) |
| §7.2 p8 | Claims | Rejections & Reasons | Claims → Rejections | Fix & resubmit; Simulators → Waystar response | W4 | Partially Implemented | Rejection workflow unspecified (Q-043) |

### Chapter 8 — CMS-1500 mapping

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| ch. 8 pp8–10 | Claims | Every box (Top, 1–33b) populated from its source | Claim → CMS-1500 | Every box filled from its source; the box-by-box mapping is in BILLING_SYSTEM_GUIDE.html | W4 | Implemented | Boxes 11a, 21, 32a flagged (Q-061, C-009, Q-060) |
| ch. 8 p9 + §10.5 p21 | Claims | Box 17/17b: referring or supervising physician with DN/DQ qualifier | CMS-1500 | Printed from the **claim's referrer snapshot**; qualifier from the physician's type | W4 | Implemented | Changing the case later does not change the claim (CH-11); corrected claims take a new snapshot (A-P44, Q-084) |
| ch. 8 p10 + §10.5 p21 | Claims | Box 24B place of service per line; Box 32 omitted for POS 02/10/12 | CMS-1500; 837P SV1 | 24B from each line; Box 32 omitted only when every line is home/telehealth | W4 | Needs Clarification | Mixed POS rule assumed (A-P40, Q-079) |
| ch. 8 pp9–10 | Claims | Conditionals: 9/9a/9d/11d secondary, 10b state, 11b PIP, 22 corrected, 23 auth, 27 assignment, 29 secondary paid | CMS-1500 on relevant claims | e.g. Harold Brennan (secondary), Linda Park (auto, PIP), corrected claims (Box 22); Box 21/27 use the effective insurance setting | W4 | Needs Clarification | Payer order on secondary claims (A-P13, Q-024) |

### Chapter 9 — Payments, denials & A/R

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §9.1 p11 | Payments | Manual payment posting | Payments → New check batch | Add claims; allowed / patient resp. / paid typed from the EOB; must balance; post | W7 | Implemented | Allowed amount comes from the remittance only (CH-08, Q-075) |
| §9.1 p11 | Payments | ERA (835) ingestion with claim-level reconciliation | Payments → ERA inbox; Simulators → ERA arrival | Review & post; denials, exceptions and secondary claims follow | W7 | Partially Implemented | Simulated payer; 835 detail waits on Waystar (Q-015, Q-018) |
| §9.1 p11 | Payments | Reconciliation equation | ERA drawer (working form); review note on the PRD wording | The application checks the working form; the note explains why the PRD wording differs | W7 | Needs Clarification | Equation does not balance (A-P16, Q-016) |
| §9.2 p11 | A/R | Payer SLA engine (manual or AI) | Admin → Insurances (SLA days); Submission & automation | Manual SLA per insurance; AI option shown disabled | W8 | Needs Clarification | SLA has no V2 column (Q-011, Q-027) |
| §9.2 p11 | A/R / Denials | Auto-escalation: SLA breach or 835 denial → Denial & A/R | A/R → Run SLA check; ERA with denials | Delayed claims get an owner task; denials land in Denial management | W8 | Partially Implemented | Timer on demand (A-P29); "cloned" undefined (Q-028) |
| §9.2 p11 | A/R / Denials | A/R categories Delayed / Denied | A/R → Delayed; Denials | Separate queues | W8 | Implemented | "Delayed" used twice (Q-028) |
| §9.2 p11 | Payments | 835 handling deferred until Waystar portal access | — | — | W7 | Not Applicable | Stated as future work by the PRD |

### Chapter 10 — Data model

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| §10.2 pp12–13 | Admin | company / practice / location | Practices & locations; switcher | Practice and location CRUD; the organization card appears only when an organization exists (Demo Data) — no screen creates one | W1 | Needs Clarification | Who creates the company and how practices join it (Q-032); review note on Practices |
| §10.2 pp13–14 | Access | app_user, role (JSON CRUD), user_practice (location_ids), user_role (union) | Users; Roles & permissions | Multi-role users with practice/location grants; Practice Admin cannot grant System Admin | — | Implemented | |
| §10.2 p14 | Access | Two roles are seeded: System Admin and Practice Admin | Fresh System (initial state); Roles & permissions | A Fresh System starts with exactly these two roles; Demo Data adds four demo roles for the walkthrough | W1 | Implemented | What else exists at installation is not stated (Q-085); first account assumed (A-P48, Q-086) |
| §10.3 p15 *(CH-15)* | Setup | provider: Provider ID, optional credential, claim hold | Admin → Providers | Provider ID column; credential optional; hold until/reason → Delayed; clearing releases | W1, W4 | Needs Clarification | Hold date meaning assumed (A-P07, Q-062) |
| **§10.3 p15** *(new, CH-02)* | Setup | **insurance_class: code, name, five rule defaults, active** | **Admin → Insurance classes** | List with rule defaults, member count and override count; create, edit, deactivate; changing a default flows to inheriting insurances | W1 | Needs Clarification | When a change takes effect assumed: next scrub (A-P42, Q-081) |
| **§10.3 p16** *(changed, CH-02)* | Setup | **insurance: class required; rules nullable (inherit) with COALESCE; insurance type** | **Admin → Insurances** | Class picker (required); each rule *Inherit / Yes / No*; live **Effective values** panel showing value and source; list shows effective rules and "overrides class" | W1 | Implemented | Class vs insurance type overlap (Q-081) |
| **§10.3 p16** *(new, CH-01)* | Setup | **insurance_hold check mark; release_bucket_id shown only when held, required then, same practice** | Admin → Insurances | Bucket field hidden until hold ticked; required when ticked; only the practice's buckets offered | W1 | Implemented | |
| **§10.3 pp16–17** *(new, CH-03)* | Setup | **release_bucket: created by Practice Admin; name unique per practice; description; active; inactive not assignable to new insurances** | **Admin → Release buckets** | Create, edit, deactivate; held insurances and waiting-claim counts; unique-name validation; inactive buckets hidden from other insurances' pickers | W1 | Needs Clarification | Deactivation with assigned insurances/waiting claims assumed (A-P41, Q-077) |
| §10.3 p16 | Setup | insurance: payer ID, address, encrypted portal credentials | Admin → Insurances | Password masked except for System Admin | W1 | Implemented | |
| **§10.3 p17** *(changed, CH-13)* | Setup | **procedure_code: procedure type, active flag (inactive not added to new lines); global; timed; default modifier/fee** | Admin → Procedure codes; charge entry | Type and status columns; editable by global roles; inactive 97039 not offered on new lines (existing lines keep their code) | W1, W4 | Needs Clarification | Inactive code arriving from the EMR (A-P46, Q-082); type's purpose (Q-083); maintainer (A-P26, Q-066) |
| **§10.3 p17** *(changed, CH-08)* | Setup | **fee_schedule: billed price only, effective dates** | Admin → Fee schedules | Billed / unit, default fee, effective dates; no allowed column | W1 | Implemented | Payer allowed amounts live only in the simulated payer (A-P34) |
| **§10.3 p18** *(changed, CH-12)* | Setup | **referring_physician: type Referring (DN) / Supervising (DQ) sets Box 17 qualifier** | Admin → Referring physicians | Type select; Box 17 qualifier follows it | W1 | Implemented | |
| §10.4 p18 *(changed, CH-14)* | Patient | patient: demographics, guarantor, emr_id, **optional SSN**, no-statements, notes; **no emergency contact** | Patients; chart → Profile | Create (with Default case), edit, deactivate, delete only without visits | W3 | Implemented | Deletion rule assumed (A-P36, Q-034) |
| **§10.4 p19** *(changed, CH-04/CH-05)* | Patient | **patient_case: referring physician, ordered ICD-10 list ≤12, injury type/date, accident state, dates — no location, providers or discipline** | Chart → Case, Diagnoses | Case form without location/provider/discipline; case shows "Visit locations" derived from visits | W3 | Needs Clarification | Hierarchy text still places them above the case (C-014) |
| §10.4 pp19–20 | Patient | case_insurance, authorization | Chart → Coverage, Authorizations | Full CRUD | W3 | Implemented | |
| **§10.5 p20** *(changed, CH-04/CH-06)* | Charges | **visit: location and providers set on the visit (EMR payload or manual entry); authorization optional; diagnosis snapshot; Review → Pended/Delayed → Released** | Charges tabs; visit detail; New charge | Visit detail edits location, billing and rendering provider; manual entry requires all three; simulator payload carries them; release, pend, re-check, refresh snapshot | W4 | Needs Clarification | No default when EMR omits them (A-P43, Q-080) |
| **§10.5 p21** *(changed, CH-09/CH-10)* | Charges | **charge_line: place of service (defaults from location), notes; balances computed not stored** | Visit detail; New charge; patient ledger | Per-line POS select and internal note; balance = amount − payments − adjustments | W4, W7 | Partially Implemented | Prototype caches the insurer/patient split for display; QA verifies it always equals the computed formula (A-P45, Q-017) |
| **§10.5 p21** *(changed, CH-11)* | Claims | **claim: 837P/CMS1500, statuses, clearinghouse ref, one per rank, referring physician snapshot** | Claims; claim detail → Claim facts, CMS-1500 | Claim facts show the snapshot physician and type; Box 17 prints it | W4 | Implemented | Status vocabulary (C-003) |
| §10.5 p22 | Payments | payment: insurance/patient/adjustment, CARC, check batches | Ledger; batches; chart → Post patient payment | Reversal posted; delete only for roles with Payments delete | W7 | Needs Clarification | Reversals vs positive amounts (A-P15, C-011) |
| §10.5 p22 | Denials | denial: CARC/RARC, Open / Appealed / Resolved / Written off | Denial management | Appeal, Correct & resend, Record outcome, Write off (each posts its rows) | W8 | Needs Clarification | Appeal detail unspecified (Q-048) |
| §10.6 pp22–23 | Access | Practice Admin limits | Throughout | No delete of sent claims or payments; closed periods locked; cannot create practices or grant System Admin; can create release buckets | — | Implemented | Limits vs flags (C-008) |
| §10.6 p23 | Access | Encrypted fields decrypted only for System Admin | Chart → Profile (SSN); Insurances (portal password) | Reveal toggle for System Admin only | — | Partially Implemented | Masking only, no real encryption |
| §10.7 pp23–24 | All | Relations at a glance | Throughout | Class → insurance, bucket → insurance, visit → location/provider, claim → referrer snapshot all navigable | — | Implemented | |

### Core principle & cross-cutting

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| Core principle p1 | All | Owner + Status + Priority + Due + Next action + History | Ownership card on visits, claims, denials; owner/due columns on queues | Edit ownership; every action written to History | All | Needs Clarification | No V2 columns (Q-003) |
| §1.4 p3 | Admin | View audit history | Admin → Audit log; History on every record | Search and module filter; release from bucket is logged | All | Needs Clarification | Scope and retention (Q-053) |
| Core principle p1 | Dashboard | Eligibility → Referral → … → Appeals flow | Dashboard "Revenue cycle" pipeline | Stages clickable from Authorization to Appeals; a review note explains that Eligibility and Referral are named but not specified | — | Needs Clarification | Q-002 |

### Named but not specified (ch. 11 p24, §10.6)

| PRD V2 Reference | Module | Feature | Prototype Screen | Prototype Interaction | Workflow | Status | Notes |
|---|---|---|---|---|---|---|---|
| ch. 11 p24 | Dashboard | Dashboards | Dashboard | Labelled example KPIs, pipeline, batch, holds by reason, A/R aging, alerts, activity | — | Needs Clarification | Q-051 |
| ch. 11 p24 | Reports | Analytics & reports | Reports | Six example reports; CSV export; a review note says they are illustrations | — | Needs Clarification | Q-050 |
| §10.6 p23 | Month End | Month End | Month end | Close period; reopen locked for Practice Admin | — | Needs Clarification | Q-049 |
| ch. 11 p24 | Payments | Posting module | Payments | See §9.1 | W7 | Partially Implemented | Q-001 |
| ch. 11 p24 | Denials / A/R | Denial & A/R management | Denial management, A/R follow-up | Queues, work types, SLA escalation | W8 | Needs Clarification | Q-001, Q-048 |
| ch. 11 p24 | Patient / A/R | Eligibility & claim-status integration | — (review notes on Coverage and A/R) | Not offered in the application | — | Not Implemented | Not specified (Q-002) |

---

## 2. Summary by status

| Status | Count |
|---|---|
| Implemented | 36 |
| Partially Implemented | 14 |
| Needs Clarification | 38 |
| Not Implemented | 1 |
| Not Applicable | 1 |
| **Total rows** | **90** |

**Not demonstrable in a local prototype (Not Applicable beyond the table):** the real EMR API; Waystar EDI exchange (837P, 835, 277CA); a real AI coding engine; real authentication (SSO/MFA); encryption at rest; persistence and multi-user concurrency; background schedulers and the passage of time (the demo date is fixed at 09/15/2026); notifications (not in the PRD); HIPAA controls, retention and performance.

**Traceability check:** every screen and action in the prototype traces to a row above, to a prototype assumption in section 5, or to a prototype simulator standing in for an external system. The enrollment list (A-P08), unit caps / SLA days / claim format (A-P18) and the ownership card (Q-003) are prototype additions for requirements V2 names without a data home; they are labelled as such on screen.

---

## 3. What changed in the prototype for PRD V2

| Change | Driven by | Where |
|---|---|---|
| New **Admin → Insurance classes** screen; every insurance requires a class; rules Inherit / Yes / No with a live effective-values panel; engine reads effective (inherited) rules everywhere | CH-02 | `screens/admin.js`, `engine.js` (`E.eff`, `E.classOf`) |
| "Manual Submission" hold replaced by **insurance hold + release bucket**: new **Admin → Release buckets** screen, new **Claims → Release buckets** tab with Release / Release all, bucket-named scrub result, release recorded, never auto-resubmitted | CH-01, CH-03 | `screens/admin.js`, `screens/claims.js`, `engine.js` (`releaseFromBucket`, `waitingInBucket`) |
| Case loses location, billing provider and discipline; **visit** carries them; manual entry requires them; EMR simulator payload sends them; location-scoped access uses visit locations | CH-04 | `data.js`, `screens/patients.js`, `screens/charges.js`, `simulator.js`, `store.js` |
| **Place of service and internal note per charge line**; CMS-1500 24B and 837P SV1 per line; Box 32 rule across lines | CH-10 | `screens/charges.js`, `screens/claims.js` |
| **Referring physician snapshot** stored on each claim and printed in Box 17 | CH-11 | `engine.js` (`newClaim`), `screens/claims.js` |
| Fee schedule **billed price only**; payer allowed amounts moved to `payerContracts`, read only by the simulated payer | CH-08 | `data.js`, `screens/admin.js`, `screens/exceptions.js`, `engine.js` (`adjudicate`) |
| Balances verified against **amount − payments − adjustments**; seeded "duplicate resolved" denial now posts its CO-18 adjustment so the formula holds | CH-09 | `engine.js` (`lineBalanceComputed`), `data.js` |
| **Procedure type and active flag**; inactive codes not offered on new lines | CH-13 | `data.js`, `screens/admin.js`, `screens/charges.js` |
| Emergency contact removed; SSN marked optional; provider code labelled Provider ID, credential optional; referrer type labelled per V2 | CH-12, CH-14, CH-15 | `screens/patients.js`, `screens/admin.js` |

**Removed as obsolete V1 behaviour:** the "Release manually" action and "Manual Submission" hold label; case location/billing provider/discipline fields; visit-level place-of-service select; fee-schedule allowed column; emergency-contact fields; insurance `class` text; per-insurance-only billing rules.

**Seed data outcomes are unchanged** apart from one intended addition (a GEICO claim waiting in "Manual Release – Auto / No-Fault"): the same visits pend, delay and raise exceptions, and posted insurance payments total the same $6,301.07 as before.

---

## 4. Implemented end to end

Practice/location onboarding · users, roles and permission matrix · practice/location scoping for 5 demo roles · patients, cases, diagnoses, coverage, authorizations · **insurance classes with inheritance and overrides** · **release buckets and releasing held claims** · manual charge entry with visit-level location and providers · record reconciliation and Inactive Records · all five billing-exception levels with working fixes · Charge Review · single and bulk submission · Updated queue with all three actions · Replace/Drop coding rules · six scrubbing checks with hold queues and auto-resubmit · claim lifecycle, corrected and void claims · daily batch metrics · full CMS-1500 mapping with sources, **per-line place of service** and **referrer snapshot** · manual check-batch posting · patient payments and reversals · secondary claims · denial work queue and A/R follow-up · ownership and history on actionable items · audit log · masking of encrypted fields · responsive layout.

---

## 5. Prototype assumptions

None of these are confirmed requirements. Each is the simplest behaviour that lets the demo flow work, and each points at the question that would settle it. Retired IDs are kept for traceability.

| ID | Assumption | Question |
|---|---|---|
| A-P01 | Intake order: draft profile → billing exceptions → provider hold → primary coverage / authorization → Charge review. | C-003 |
| A-P02 | Visit statuses beyond V2's four: Billing exception, Incomplete profile, Claim created, Inactive. | C-003 |
| A-P03 | Claim statuses: Scrubbing, Hold (with reason, incl. release bucket), Submitted, Rejected, Paid, Denied, Replaced, Voided, Cancelled. Delayed A/R is a flag on a Submitted claim. | C-003, Q-028 |
| A-P04 | Coding rules first, then the six checks in §6.2 order; the first failure decides the single queue. The release-bucket check is last, so only otherwise-clean claims reach a bucket. | Q-010, Q-012 |
| A-P05 | Any save that could fix a cause re-scrubs held claims (except release buckets) and re-evaluates waiting visits. | Q-012 |
| A-P06 | An authorization is consumed when the primary claim is submitted; remaining = approved − used; one unit per visit. | Q-009 |
| A-P07 | Provider claim hold: a visit is Delayed while today and its date of service are both before the hold date. | Q-062 |
| A-P08 | Credentialing is a per-provider list of payer enrollments (Active / Pending / Not enrolled, effective date). | Q-010 |
| A-P09 | Character limits: name 30, address line 35; the exception offers truncate or edit. | Q-007 |
| A-P10 | Completing a draft provider or insurance releases its quarantined sessions automatically. | Q-005, Q-006 |
| A-P11 | *Retired 2026-09-16 — PRD V2 defines referring physician type as Referring (DN) / Supervising (DQ).* | — |
| A-P12 | Coding rules apply to primary claims only; secondary claims reuse those codes. | Q-013 |
| A-P13 | A secondary claim is created automatically when the primary remit leaves an insurer balance; Box 29 = primary paid; primary shown in Box 9. | Q-017, Q-024 |
| A-P14 | Patient payments apply to the oldest patient balance first; any remainder is an unapplied credit. | Q-046 |
| A-P15 | A reversal is a separate positive "Reversal" row that restores the balance; only roles with Payments delete may delete rows. | C-011, C-008 |
| A-P16 | Reconciliation uses the working form (Billed − Contractual = Allowed; Allowed − Patient resp. = Paid); the PRD's equation is displayed and flagged. | Q-016 |
| A-P17 | *Retired 2026-09-16 — PRD V2 puts place of service on each charge line (CH-10); see A-P40.* | — |
| A-P18 | Insurance has extra settings with no V2 column: max units per line, SLA days, claim format (837P or paper). | Q-011, Q-040 |
| A-P19 | The payer claim number is assigned at submission and used as the Box 22 original reference. | Q-019 |
| A-P20 | A corrected claim (7) uses the updated lines; a void (8) keeps the original lines; the original becomes Replaced or Voided. "Submit anyway" creates a second visit and claim. | C-004, Q-044 |
| A-P21 | Organization Admin: all modules across its organization's practices; not global; no decryption; cannot create practices. | C-002, Q-032 |
| A-P22 | Domain Admin: Dashboard and Admin view-only, EMR integration edit; a System or Organization Admin approves integration requests. | C-002, Q-029 |
| A-P23 | EMR integration is its own permission key (INTEGRATION). | C-001 |
| A-P24 | Edit = create/read/update (+ delete when ticked), View = read, Hidden = none. | C-001 |
| A-P25 | *Retired 2026-09-16 — replaced by A-P39 (cases no longer carry a location).* | — |
| A-P26 | Only global roles can edit the shared procedure-code list (including its active flag). | Q-066 |
| A-P27 | The practice scope, labelled "Company" per §10.2, sits in the sidebar (EMR-V.2 "scope is chrome") rather than top right. | C-010 |
| A-P28 | Payment exceptions are fixed by mapping the line to a claim or adding the code mapping; the remittance then posts. | Q-018 |
| A-P29 | The SLA engine runs on demand; escalated claims get owner, priority, due date and next action. | Q-027 |
| A-P30 | Closing a period opens the next; reopening needs Month End update rights; posting into closed periods is not blocked. | Q-049 |
| A-P31 | One visit per case per date of service is enforced for manual entry but not for EMR pushes. | C-005 |
| A-P32 | Scheduled submission is "Run scheduled job now"; the interval is stored. | Q-041 |
| A-P33 | The AI coding check is two rules: a line with no pointer; 97750 supported only by R/Z codes. | Q-014 |
| A-P34 | ERA adjudication by the simulated payer: allowed = the payer's own contract rate from `payerContracts` (80% of charge if none), never the fee schedule; coinsurance 20% Medicare, 10% commercial, 0% WC/PIP; denial CARCs chosen by the user. | Q-075 |
| A-P35 | Visual source is EMR-V.2's live `src/index.css` ("instrument" direction). | — |
| A-P36 | A patient with visits can't be deleted, only deactivated. | Q-034 |
| A-P37 | Claims waiting in a release bucket are never resubmitted automatically, even if the insurance hold is later unticked. | C-013, Q-077 |
| A-P38 | Any user with Billing update rights may release claims from any bucket of their practice, one claim or a whole bucket; release re-runs the scrubbing checks and records who released and when. | Q-076 |
| A-P39 | A location-restricted user sees a patient if any of that patient's visits is at an allowed location, or if the patient has no visits yet; visits and claims filter by the visit's location. | Q-031 |
| A-P40 | Box 32 (service facility) is omitted only when every line on the claim is home or telehealth (02, 10, 12). | Q-079 |
| A-P41 | Deactivating a bucket leaves its assigned insurances and waiting claims in place; an insurance already assigned to an inactive bucket keeps it selectable. | Q-077 |
| A-P42 | A changed insurance-class default applies at each claim's next scrub; claims already submitted are unaffected. | Q-081 |
| A-P43 | The simulated EMR sends the location and billing provider of the episode's most recent visit (or the practice's primary location and first active provider). Manual entry requires both; there is no case default. | Q-080 |
| A-P44 | A corrected or void claim is a new claim, so it takes a fresh referrer snapshot from the case at its creation. | Q-084 |
| A-P45 | The prototype keeps the insurer / patient split of each line's balance (V2 does not say how to derive it); automated QA confirms the displayed balance always equals amount − payments − adjustments. | Q-017 |
| A-P46 | An EMR charge using an inactive procedure code is not blocked (no scenario sends one); only manual entry hides inactive codes. | Q-082 |
| A-P47 | Both environments load the standard ICD-10 (a short list), CARC and RARC code sets as lookups; they are code standards, not practice data. Procedure codes, fees and insurance classes are **not** pre-loaded in the Fresh System. | Q-085 |
| A-P48 | A Fresh System has one System Administrator account (`admin`) to sign in with; that person creates the first practice. | Q-086 |
| A-P49 | A new practice starts with the current month open as its accounting period, so Month end can be used; closing it opens the next (A-P30). | Q-085, Q-049 |

---

## 6. Open questions the prototype makes most visible

1. **Release buckets** — who may release, does release re-check, and what happens when a hold or bucket changes? (Q-076, Q-077, C-013)
2. **Visit data after V2** — where location and providers come from when the EMR omits them; whether a case should have any default. (Q-080, C-014)
3. **Money** — the equation, the missing expected allowed amount, and the insurer/patient split of calculated balances. (Q-016, Q-075, Q-017)
4. **One status model** for visits, claims, holds and buckets. (C-003, Q-028)
5. **Permissions and roles** — per-role vs per-user, Organization and Domain Admin, and the release right. (C-001, C-002, Q-076)
6. **Insurance classes** — when a changed default applies; how class relates to insurance type. (Q-081)
7. **Claim boxes** — Box 32 with mixed places of service; referring and supervising together; corrected claims' referrer. (Q-079, Q-078, Q-084)
8. **Corrected claims** — duplicates with "Submit anyway"; source of the Box 22 reference. (C-004, Q-019)
9. **Scrubbing inputs** — credentialing data, unit caps, conditional boxes, SLA. (Q-010, Q-011)
10. **Unspecified modules** — dashboards, reports, month end, eligibility. (Q-001, Q-050, Q-051, Q-049, Q-002)

---

## 7. Verification (QA pass, 2026-09-16, after the V2 migration)

- **172 automated checks in headless Chromium (Playwright), all passing, zero console or page errors:**
  - **Regression walk-through (51 checks):** 54 routes rendered for each of 5 roles; the full cycle through the UI — EMR push → review → release → bulk submission with coding rules, credentialing hold and a GEICO claim routed to its release bucket → **release from the bucket** → authorization fix with auto-resubmit → Waystar reject/resubmit/accept → ERA posting with a secondary claim and payment exceptions → exception fixes → incomplete-profile completion → denial actions → SLA escalation → updated note to corrected claim and void → a check batch refused until balanced; **manual charge refused until location and billing provider are chosen.**
  - **Editors and long tail (73 checks):** every Admin editor, all 11 simulator scenarios, form validation, role restrictions, location narrowing, practice switching, **per-line place of service**, CSV export, print, reset, mobile drawer.
  - **PRD V2 behaviour (48 checks):** data model shape (no V1 fields remain; every insurance has a class; lines carry POS; claims carry a referrer snapshot); effective-rule inheritance and overrides; class change flowing to inheriting insurances; release-bucket CRUD and unique names; hold ↔ bucket field visibility and requirement; inactive buckets not offered; release and release-all; bucketed claims not auto-resubmitted; Box 17 from snapshot; Box 24B per line and Box 32 rule; fee schedule without allowed column; inactive codes not offered; case without location/provider/discipline; patient without emergency contact; simulator payload with billing provider; balances equal amount − payments − adjustments on every billed line, before and after posting an ERA; view-only role cannot release; new routes error-free for all roles.
- **Seed comparison:** V1 and V2 seeds produce identical holds, pended/delayed/exception visits and posted payments ($6,301.07), except the one intended GEICO release-bucket claim.
- **Issue found and fixed during the V2 QA:** a seeded "duplicate claim resolved" denial set the line balance to zero without posting a row, which V2's computed balances would never allow. It now posts a CO-18 adjustment.
- **Layouts:** new screens follow the existing EMR-V.2 components (tables, underline tabs, modals, notices); checked at 1440 px.

---

## 8. Prototype environments

The prototype opens on a chooser (`#/welcome`). Both environments run **the same screens, the same PRD V2 rules and the same code**; only the starting data differs. They are separate in-memory data sets: choosing one builds its data from scratch.

| | **Demo Data** | **Fresh System** |
|---|---|---|
| Purpose | See the finished system quickly — a practice that has been billing for months | Learn how the system works from the beginning — day one of a new installation |
| Starts with | 1 company, 2 practices, 4 locations, 8 insurance classes, 10 insurances, 4 release buckets, 8 providers, 17 procedure codes, 29 patients, 95 claims, 6 roles, 9 users, plus payments, denials, exceptions, holds and audit history | Only what V2 seeds — **two roles** (System Admin, Practice Admin; §10.2 p14) — plus the prototype's sign-in account (A-P48) and standard code sets (A-P47). No company, practice, location, provider, insurance, code, patient, charge, claim or payment |
| Sign in as | Any of 7 accounts (start as Tomás Herrera, Practice Admin) | The System Administrator, plus any user created in the session |
| Guidance | Review notes on the screens themselves; the full cycle is in BILLING_SYSTEM_GUIDE.html | Review notes on the screens themselves; the order records must be created in is in BILLING_SYSTEM_GUIDE.html chapter 12 |
| Indicator | Named in the review-notes popover only, never in the application | Named in the review-notes popover only, never in the application |
| Reset | Review notes → Prototype… → Reset the demo data → rebuilds the identical seed | Review notes → Prototype… → **Reset the Fresh System** → back to the empty initial state |

**Switching.** Review notes → Prototype… → "Switch to …" (also Alt + Shift + S). A prototype-styled confirmation warns *"Your current … session will be reset — everything created or changed in it is discarded."* Switching rebuilds the target environment from its starting point and returns to sign-in. "Start screen" in the same menu returns to the chooser, where review notes can also be switched off.

**Isolation.** Each load creates a new data object and resets every id counter and sequence (record ids, claim numbers, run and ERA numbers, simulated EMR record ids). Nothing created in one environment appears in the other, and a Demo reset reproduces identical ids and claim numbers (checked in 9.8).

**What decided "empty".** V2 was read for anything that must exist before users enter data:

| Record | V2 says | Fresh System |
|---|---|---|
| Roles | "Two roles are seeded: System Admin … and Practice Admin" (§10.2 p14) | Both present, with the §10.6 Practice Admin defaults |
| First user | Not stated | One System Admin account — **assumption A-P48, Q-086** |
| Company | Optional grouping (§10.2 p13) | None |
| Practice, location | Supplied "whenever an account is initialized"; a primary location "is mandatory during initial account creation" (§1.1–1.2 p2) | None until created; the primary location is created **with** the practice |
| Procedure codes | "Shared reference data, not owned by a practice" (§10.3 p17); no seed stated | Empty — **Q-085** |
| System Default Fee Schedule | Named (§3.4 p4), contents not stated | No fee rows; codes use their default fee — **Q-085** |
| ICD-10, CARC / RARC | Used as values (§10.4 p19, §10.5 p22); no lookup table | Standard lists loaded — **assumption A-P47, Q-085** |
| Insurance classes | Each insurance needs one (§10.3 pp15–16); no seed stated | Empty |
| Default case | "Every patient has at least a 'Default' case" (§10.4 p19) | Created with each patient |
| Accounting period | Periods can be closed (§10.6 p23); creation not stated | Current month opened with each new practice — **assumption A-P49** |

---

## 9. Fresh System workflows

### 9.1 Initial state
Sign-in lists only **System Administrator**. Every business list is empty. Every screen that needs a practice shows **"No practice yet"**: what is missing (a practice), why (everything belongs to exactly one practice, §10.2) and what to do (Create the practice). Only Admin (practices, users, roles, procedure codes, audit) works before a practice exists. Review notes on Practices explain what a new installation starts with.

### 9.2 Empty states (what · why · next)

| Screen | The empty state tells the user |
|---|---|
| Dashboard | All figures 0; "Nothing needs attention" explains that no charges exist yet; "No activity yet" |
| Admin → Practices | "No practices yet": a practice is the billing entity; creating it also creates the mandatory primary location; only a System Admin can create one |
| Admin → Insurance classes, Insurances, Providers, Procedure codes, Referring physicians, Release buckets, Coding rules | What the record is for in billing and the create action (Insurances points to classes first; Coding rules are optional). V2 references and Q-085 are in the review notes |
| Admin → Fee schedules | "Nothing to price yet" plus a checklist: an insurance and a procedure code |
| Patients | "No patients yet — patients arrive from the EMR with their first finalized note, or can be added here" |
| Charges tabs, Exceptions, Claims tabs, Daily batches, Payments tabs, Denials tabs, A/R, Reports | Tab-specific: what would appear there and what produces it (e.g. "Electronic remittances from payers appear here when they arrive"); scheduled submission shows "Last run never" |
| Month end | The current month is open (A-P49, explained in a review note); if a practice has no period, “No accounting periods” |

### 9.3 First actions
1. Choose **Fresh System** → sign in as System Administrator.
2. **Create the practice** (legal name, Tax ID, taxonomy, group NPI, address) with its **primary location** in one form. It becomes the working practice.
3. Continue in the order in 9.6; each screen says what it still needs.

### 9.4 Required dependencies (explained, not just disabled)
When a prerequisite is missing the **application** explains it with a checklist (✓ present / ✗ missing, why, and a button to the right screen) — ordinary product help. The V2 references for each dependency are in the review notes:

| Action | Needs (V2) | Where explained |
|---|---|---|
| Add an insurance | An active insurance class (§10.3) | Insurances → New insurance |
| Add coverage to a case | An insurance, and so a class (§10.3–10.4) | Chart → Coverage → Add coverage |
| Add an authorization | Coverage on the case (§10.4) | Chart → Authorizations |
| Case referring physician | A referring physician (§10.4) | Case editor note with "Add a referring physician" |
| New charge | Patient; case with a diagnosis; active location; provider; active procedure code (§10.4–10.5) | Charges → New charge (panel at the top) |
| Fee schedule row | An insurance and a procedure code (§10.3) | Admin → Fee schedules |
| Coding rule | Procedure codes (§6.1) | Coding rules → New rule |
| Provider enrollment | Insurances (prototype enrollment list, A-P08) | Provider editor |
| User practice grants | A practice (§10.2) | User editor |
| Simulator: EMR push | Location, provider with NPI, insurance, procedure code; a linked, **Integrated** location or the payload is blocked (§2.3) | Simulator (prototype-styled): checklist when nothing can be sent; warning when the location is not integrated; demo-only scenarios hidden, the rest say "Not available yet — why" |
| Simulator: ERA arrival | A released charge and a submitted claim (§9.1); mentions claims on hold or in a bucket | Simulators → ERA arrival |
| New check batch | An insurance and a submitted claim (§9.1, §10.5) | Payments → New check batch |

### 9.5 Progressive data creation
Every dashboard figure, tab count, report and queue in the application is computed from what the user created.

### 9.6 Full business cycle (verified through the UI)
Practice + primary location → insurance class → insurance → procedure code → provider (NPI, enrolled with the payer) → referring physician → patient (Default case created) → coverage → case referrer → diagnosis → **manual charge** (Charge review) → **release** → **submit** (scrubbing passes; claim numbered from the start of the sequence) → simulated **Waystar response** (accepted) → simulated **ERA arrival** → **Post ERA** → claim **Paid**, payment and adjustment rows, patient balance → dashboard figures move → **Close the month** (the next period opens) → optional: request, link and elect the location **Integrated** in EMR integration → simulated **EMR push** → the session lands in Charge review.

### 9.7 Reset
Review notes → Prototype… → **Reset the Fresh System** → confirmation *"This removes every record created during this session and returns the system to its initial empty state: two seeded roles and the System Administrator account."* → the empty initial state, with the System Administrator still signed in.

### 9.8 Environment QA (2026-09-17)
- **Fresh System walkthrough (55 checks, headless Chromium), all passing, zero console errors:** chooser; initial state of exactly two roles and one account; product-only sign-in; no-practice empty states; dependency explanations before prerequisites exist; the full cycle in 9.6; balances equal amount − payments − adjustments; the practice built end to end through the product screens; product dashboard; month close; EMR integration and push; product audit wording; switch to Demo (confirmation, Demo seed untouched, no Fresh records); switch back (Fresh empty again, nothing from Demo); Reset Fresh System; Demo reset reproduces identical ids and claim numbers; chooser at phone width.
- **Route crawl:** 51 routes in the Fresh System, with no practice and with an empty practice — no crashes or console errors.
- **Demo Data regression:** the existing suites (51 + 73 + 48 checks, section 7) pass unchanged apart from starting at the chooser.

---

## 10. Review Notes — the product, annotated

**Principle.** *The prototype simulates the product; a thin annotation layer marks what is unresolved.* The Billing System screens contain product content only. Assumptions, client questions and short contextual notes live in **Review Notes**: one small control, numbered markers on the area each note is about, and a small popover. There is no guide application, no walkthrough and no navigation of its own.

### 10.1 Three layers

| | Where | What it answers |
|---|---|---|
| **The product** | `js/*.js`, `js/screens/`, `css/screens.css` … | How the Billing System works |
| **Review Notes** | `js/prototype/review-notes.js`, `css/prototype.css` | What is assumed, unresolved or simulated on *this* screen |
| **`BILLING_SYSTEM_GUIDE.html`** | project root | How the whole business cycle works — diagrams, workflows, glossary, worked example |

The unresolved requirements themselves stay in `PRD_CLARIFICATION_QUESTIONS.md`; a note cites the ID and links to the register.

### 10.2 The layer

| Piece | Behaviour |
|---|---|
| Control | `Review notes · n` — a small button, bottom right, counting the notes for the current screen; `Review notes` when there are none |
| Markers | Numbered, beside the field or area a note is about, in their own overlay (`#rn-markers`) so the application markup is never touched. A marker hides when its element scrolls out of view, and while a dialog is open only that dialog's markers show |
| Popover | The list for this screen (number, title, type), or one note: type, two sentences, the register ID, the PRD section and page. "No review notes for this screen." when empty |
| Types | **Assumption** · **Client question** · **Note** — nothing else |
| Off | "Hide notes", the start-screen checkbox, or **Alt + Shift + N**. With notes off nothing from the layer is on screen |
| Prototype controls | The popover footer opens the simulators (EMR push, Waystar response, ERA arrival, payer SLA check, scheduled submission) and the environment actions (switch, reset, start screen). **Alt + Shift + S** opens them directly |

No emoji, no colour blocks, no illustrations: neutral ink, hairlines and the existing type scale. The layer reads the route only — it never touches application data, workflows, statuses, permissions or calculations.

### 10.3 Content

`ReviewNotes.NOTES` in `js/prototype/review-notes.js` is the one place review content lives, kept apart from product and business data:

```js
{ id, screen: (parts, query) => boolean, anchor: 'CSS selector' | undefined,
  type: 'assumption' | 'question' | 'note', title, body, q: ['Q-011'], ref: '§6.2 p7' }
```

57 notes cover 46 of the 57 routes, at most 3 on a screen. Each body is two sentences or fewer; every assumption and question cites the register, the PRD, or both.

### 10.4 What stays in the product, and what becomes a note

Product (kept): field help, validation, empty states that say what appears there and how to create it, prerequisite checklists ("Before a charge can be entered"), and the business wording a real user needs.

Notes (kept out of the UI): PRD citations, question and contradiction IDs, assumption wording, "not yet specified" notices, prototype limitations such as "the EMR is simulated", simulate buttons and environment controls.

### 10.5 QA (2026-09-17)

- **Review Notes suite (33 checks, headless Chromium), all passing, zero console errors:**
  - *Notes off:* 57 routes and 162 dialogs and menus scanned for PRD, §, question and assumption IDs, "assumption", "prototype", "simulate", "not specified", V1/V2, "demo", "environment" and similar — **none found**; no control, marker or popover anywhere; the application stays fully usable; Alt + Shift + S still reaches the simulators, whose dialogs are marked as prototype controls, and the simulated event is handled by the application.
  - *Notes on:* one control no taller than 34 px showing the count for the screen; markers only where a note has an anchor, rendered outside `#app`; **no emoji in the layer**; a marker opens one short note with its type, register ID and PRD reference, and the ID links to `PRD_CLARIFICATION_QUESTIONS.md`; back returns to the screen list; counts follow the route (Dashboard 3, Release buckets 2, Payments 3, Roles 1, Pended 0 with "No review notes for this screen."); a marker inside a dialog points at one field and stays hidden until that field is in view; the popover footer reaches the simulators and environment actions; "Hide notes" and Alt + Shift + N work and the choice is stored; **opening notes changes no application data**.
  - *Fresh System:* the empty-installation notes appear on Practices and Procedure codes and nowhere else.
  - *Content:* three types only, unique IDs, every body at most 330 characters, every question and assumption referenced.
  - *Phone (390 px):* the popover fits without sideways scroll.
- **Application regression with notes off:** 51 + 73 + 48 checks and the Fresh System suite (55) pass; the 51-route Fresh crawl is clean.
