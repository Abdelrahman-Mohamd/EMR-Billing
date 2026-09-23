/* PROTOTYPE LAYER — Review Notes.
   A quiet annotation layer over the Billing System: assumptions, client questions and
   short notes attached to the screen they belong to. It reads the route, never the
   application's data model, and never changes anything the application does.

   NOTES   the content, kept separate from product data
   Review  the UI: one control, numbered markers, a small popover

   Off   → nothing on screen; the prototype looks like the product.
   On    → "Review notes · n" control, plus markers ① where a note belongs to one field.
   Alt + Shift + N toggles · Alt + Shift + S opens the simulators. */

const ReviewNotes = (() => {
  /** screen: (parts, query) → is this note relevant here
   *  anchor: optional CSS selector inside the application the marker points at
   *  type:   'assumption' | 'question' | 'note'
   *  q:      clarification-register IDs · ref: PRD V2 section and page */
  /** exact route: same depth and same segments */
  const at = (...path) => (p) => p.length === path.length && path.every((seg, i) => p[i] === seg)
  /** any route under this section, whatever the tab or record */
  const inSection = (root) => (p) => p[0] === root
  /** one tab of a section, where dflt is the tab shown when none is in the URL */
  const tab = (root, dflt, t) => (p) => p[0] === root && (p[1] || dflt) === t
  const claimTab = (t) => (p, q) => p[0] === 'claims' && p[1] === 'view' && (q.tab || 'summary') === t
  const chart = (t) => (p) => p[0] === 'patients' && !!p[1] && (p[2] || 'profile') === t
  const fresh = (fn) => (p, q) => Env.isFresh() && fn(p, q)

  const NOTES = [
    // ---------------------------------------------------------------- sign in
    { id: 'n-login-roles', screen: at('login'), anchor: '.choice-list', type: 'assumption', title: 'Two of these roles are not defined',
      body: 'V2 names Organization Admin and Domain Admin but gives permissions for System Admin and Practice Admin only. Their access here is assumed: Organization Admin sees its company’s practices, Domain Admin handles EMR integration.', q: ['C-002'], ref: '§1.3 p2 · §10.6 pp22–23' },
    { id: 'n-login-auth', screen: at('login'), type: 'note', title: 'No authentication in the prototype',
      body: 'Choosing an account signs in immediately. Sign-in, passwords and SSO are not specified in V2.', q: ['Q-025'] },

    // ---------------------------------------------------------------- dashboard
    { id: 'n-dash-scope', screen: at('dashboard'), anchor: '.fig-band', type: 'note', title: 'Dashboard content is an example',
      body: 'V2 lists dashboards as in scope but does not specify them. These figures are examples, calculated live from this practice’s data.', q: ['Q-051'], ref: 'ch. 11 p24' },
    { id: 'n-dash-cycle', screen: at('dashboard'), anchor: '.pipeline', type: 'question', title: 'Eligibility and Referral are missing from the cycle',
      body: 'The core flow starts with Eligibility and Referral, but no chapter describes them and no data is defined, so the prototype cannot show them.', q: ['Q-002'], ref: 'Core principle p1' },
    { id: 'n-dash-owner', screen: at('dashboard'), type: 'assumption', title: 'Ownership fields have no home in the data model',
      body: 'The core principle asks for owner, status, priority, due date, next action and history on every item. V2’s tables have no columns for them; the prototype stores them alongside each record.', q: ['Q-003'], ref: 'Core principle p1' },

    // ---------------------------------------------------------------- patients & cases
    { id: 'n-pat-scope', screen: at('patients'), type: 'assumption', title: 'What a location-restricted user sees',
      body: 'V2 does not say what location access restricts. Here a user limited to one location sees patients who have a visit there, plus patients with no visits yet.', q: ['Q-031'], ref: '§10.2 p14' },
    { id: 'n-pat-emr', screen: at('patients'), type: 'note', title: 'Patients normally arrive from the EMR',
      body: 'An integrated location sends the patient, case and coverage with the first finalized note. The EMR is simulated in this prototype.', q: ['Q-004'], ref: '§2.3 p3 · §4.1 p5' },
    { id: 'n-chart-guarantor', screen: chart('profile'), anchor: '[name="gLine1"]', type: 'note', title: 'Guarantor address added',
      body: 'V2 stores the guarantor as name, address, date of birth and relationship. The address was added after the meeting; the date of birth is still not captured.', q: ['Q-069'], ref: '§10.4 p18' },
    { id: 'n-chart-ssn', screen: chart('profile'), type: 'note', title: 'Masked, not encrypted',
      body: 'V2 encrypts the SSN and decrypts it only for a System Admin. The prototype masks the value for every other role but stores it in plain memory.', ref: '§10.6 p23' },
    { id: 'n-chart-del', screen: chart('profile'), type: 'assumption', title: 'Deleting a patient',
      body: 'V2 does not say what happens to a patient with billing history. A patient with visits can only be deactivated here.', q: ['Q-034'], ref: '§10.4 p18' },
    { id: 'n-case-where', screen: chart('case'), type: 'question', title: 'Where treatment happened is no longer on the case',
      body: 'Chapter 3 still places location and providers above the case, while the V2 data model sets them on each visit. The prototype follows the data model.', q: ['C-014'], ref: '§3.1 p4 · §10.4 p19' },
    { id: 'n-case-cause', screen: chart('case'), anchor: '[name="injuryType"]', type: 'assumption', title: 'A case without a related cause',
      body: 'Related cause offers employment and auto only. Left empty, Boxes 10a, 10b and 10c all answer NO and the injury date is asked for only when the payer requires it.', q: ['Q-092'], ref: '§5.2 p6 · ch. 8 p9' },
    { id: 'n-case-emp', screen: chart('case'), anchor: '[name="employmentStatus"]', type: 'note', title: 'Employment status has no column',
      body: 'The exception rules require it for workers’ compensation, but V2’s data model has no field for it. The prototype keeps it on the case.', q: ['Q-008'], ref: '§4.4 p6' },
    { id: 'n-cov-elig', screen: chart('coverage'), type: 'question', title: 'No eligibility check',
      body: 'Eligibility verification is named in the PRD’s next steps but not specified, so the prototype does not offer it.', q: ['Q-002'], ref: 'ch. 11 p24' },
    { id: 'n-cov-dates', screen: chart('coverage'), anchor: '.cov-card', type: 'question', title: 'Coverage dates are required but not stored',
      body: 'Chapter 3 asks for effective and termination dates on a case insurance; the V2 table has no columns for them.', q: ['C-007'], ref: '§3.2 p4 · §10.4 p19' },
    { id: 'n-auth-use', screen: chart('authorizations'), type: 'assumption', title: 'How an authorization is used up',
      body: 'V2 counts approved and used visits without saying when one is consumed. Here one visit is consumed when its primary claim is submitted.', q: ['Q-009'], ref: '§3.2 p4' },

    // ---------------------------------------------------------------- charges
    { id: 'n-ch-review', screen: tab('charges', 'review', 'review'), type: 'note', title: 'The last human checkpoint',
      body: 'Every visit is checked here before it can become a claim. Releasing moves it to Ready to submit; pending it holds it until something outside billing is fixed.', ref: '§10.5 p20' },
    { id: 'n-ch-emr', screen: tab('charges', 'review', 'review'), type: 'note', title: 'EMR sessions are simulated',
      body: 'No EMR is connected. Use the prototype simulator (Alt + Shift + S) to send a finalized note into billing.', q: ['Q-004'] },
    { id: 'n-ch-ready-name', screen: tab('charges', 'review', 'ready'), type: 'question', title: 'Rename this queue to “Manual submission”?',
      body: 'The meeting asked for that name, but this queue also feeds the scheduled job, and “Manual Submission” was the V1 hold that V2 replaced with release buckets. The name is unchanged until that is settled.', q: ['Q-093'], ref: '§5.1 p6' },
    { id: 'n-ch-ready', screen: tab('charges', 'review', 'ready'), type: 'assumption', title: 'The scheduled job does not run on a timer',
      body: 'V2 asks for scheduled submission without saying when it runs, in which time zone or under whose account. The interval is stored; the run itself is triggered from the simulators.', q: ['Q-041'], ref: '§5.1 p6' },
    { id: 'n-ch-updated', screen: tab('charges', 'review', 'updated'), type: 'question', title: '“Submit anyway” can create a duplicate',
      body: 'V2 allows a re-sent note to be submitted as a new claim, but also says one claim per payer per visit, and does not say how duplicates are prevented.', q: ['C-004', 'Q-019'], ref: '§5.2 p6' },
    { id: 'n-ch-new-where', screen: at('charges', 'new'), anchor: '#mc-locationId', type: 'assumption', title: 'Location and providers per visit',
      body: 'V2 sets both on the visit “from the EMR payload or manual entry”, with no default from the case. Manual entry requires them; the simulated EMR reuses the episode’s last visit.', q: ['Q-080'], ref: '§10.5 p20' },
    { id: 'n-visit-pos', screen: (p) => p[0] === 'charges' && p[1] === 'visit', type: 'question', title: 'Place of service is per line, Box 32 is per claim',
      body: 'When lines of one visit carry different places of service, V2 does not say which decides Box 32. The prototype omits Box 32 only when every line is home or telehealth.', q: ['Q-079'], ref: '§10.5 p21 · ch. 8 p10' },
    { id: 'n-visit-bal', screen: (p) => p[0] === 'charges' && p[1] === 'visit', type: 'assumption', title: 'The insurer / patient split of a balance',
      body: 'V2 computes line balances but does not say how a balance splits between payer and patient. The prototype keeps the split it derived when posting.', q: ['Q-017'], ref: '§10.5 p21' },

    // ---------------------------------------------------------------- exceptions
    { id: 'n-exc-limits', screen: tab('exceptions', 'open', 'open'), type: 'assumption', title: 'Character limits are placeholders',
      body: 'V2 says over-long fields are “truncated or flagged” without giving limits or choosing. The prototype flags name over 30 and address over 35 characters and offers both.', q: ['Q-007'], ref: '§4.4 p5' },
    { id: 'n-exc-std', screen: tab('exceptions', 'open', 'open'), type: 'note', title: 'Only the listed triggers',
      body: 'V2 names the WebPT Billing Exceptions Guide as its reference standard. The prototype implements the triggers listed in §4.4 and nothing beyond them.', q: ['Q-065'], ref: '§4.4 pp5–6' },
    { id: 'n-exc-draft', screen: tab('exceptions', 'open', 'incomplete'), type: 'assumption', title: 'Completing a profile releases its sessions',
      body: 'V2 quarantines sessions that name an unknown provider or insurance but does not say whether completing the profile releases them automatically. Here it does.', q: ['Q-005', 'Q-006'], ref: '§4.3 p5' },

    // ---------------------------------------------------------------- claims
    { id: 'n-cl-order', screen: tab('claims', 'holds', 'holds'), type: 'assumption', title: 'One hold queue per claim',
      body: 'The six checks run in the order V2 lists them and the first failure decides the queue. V2 does not say what happens when a claim fails several checks.', q: ['Q-012'], ref: '§6.2 p7' },
    { id: 'n-cl-cred', screen: tab('claims', 'holds', 'holds'), type: 'assumption', title: 'Credentialing data is a prototype addition',
      body: 'The credentialing check needs active enrollment per payer and date of service, but V2’s data model has no table for it. Enrollments are kept on the provider here.', q: ['Q-010'], ref: '§6.2 p7' },
    { id: 'n-cl-ai', screen: tab('claims', 'holds', 'holds'), type: 'assumption', title: 'The AI coding check is a stand-in',
      body: 'V2 names an AI add-on for diagnosis-to-CPT consistency without a vendor, model or rules. Two simple rules stand in for it.', q: ['Q-014'], ref: '§6.2 p7' },
    { id: 'n-cl-bucket', screen: tab('claims', 'holds', 'buckets'), type: 'question', title: 'Who may release a claim?',
      body: 'V2 says held claims “go out only when a user releases them” without saying which role, or whether release re-checks the claim. Here anyone with Billing update rights can release, and the checks run again.', q: ['Q-076'], ref: '§6.2 p7 · §10.3 pp16–17' },
    { id: 'n-cl-bucket-how', screen: tab('claims', 'holds', 'buckets'), type: 'question', title: 'Release by mail, fax or portal?',
      body: 'The meeting asked for those three options when releasing a bucket. V2 only distinguishes an electronic 837P from a printed CMS-1500, and says nothing about fax or portal submission, so releasing still follows the payer’s claim format.', q: ['Q-095'], ref: '§7.1 p8' },
    { id: 'n-cl-bucket2', screen: tab('claims', 'holds', 'buckets'), type: 'assumption', title: 'Bucketed claims never go out by themselves',
      body: 'If the insurance hold is later removed, claims already waiting still need a person to release them.', q: ['C-013', 'Q-077'], ref: '§6.2 p7' },
    { id: 'n-cl-sent', screen: tab('claims', 'holds', 'submitted'), type: 'note', title: 'Nothing is transmitted',
      body: 'Claims are built as 837P or CMS-1500 but no clearinghouse is connected. Waystar’s answer is produced by the prototype simulator (Alt + Shift + S).', q: ['Q-015'], ref: '§7.1 p8' },
    { id: 'n-cl-sla', screen: tab('claims', 'holds', 'submitted'), type: 'question', title: 'How the payer SLA clock works',
      body: 'V2 escalates claims past the payer SLA but does not say where the SLA comes from, when the clock starts, or what stops it. Here it is a per-insurance number of days from submission.', q: ['Q-027', 'Q-011'], ref: '§9.2 p11' },
    { id: 'n-cl-batch', screen: tab('claims', 'holds', 'batches'), type: 'question', title: 'What counts as a day',
      body: 'Batch figures are “consolidated per calendar day”; V2 does not define the time zone or cut-off, or whether claims stopped in a release bucket count as held.', q: ['Q-042', 'C-013'], ref: '§7.2 p8' },
    { id: 'n-cms-box', screen: claimTab('cms1500'), anchor: '.cms-title', type: 'question', title: 'Three boxes the PRD leaves open',
      body: 'Box 11a (mandatory when the patient is the insured), Box 21’s ICD indicator fixed at 0 while the payer may use ICD-9, and which NPI belongs in Box 32a.', q: ['Q-061', 'C-009', 'Q-060'], ref: 'ch. 8 pp8–10' },
    { id: 'n-cms-32', screen: claimTab('cms1500'), type: 'assumption', title: 'When Box 32 is left blank',
      body: 'Place of service is per line, so the prototype omits the service facility only when every line on the claim is home or telehealth (02, 10, 12).', q: ['Q-079'], ref: 'ch. 8 p10' },
    { id: 'n-edi', screen: claimTab('edi'), type: 'note', title: 'Simplified 837P',
      body: 'Built from the same fields as the CMS-1500. The full loop-by-loop mapping waits on the clearinghouse specification.', q: ['Q-015'], ref: '§7.1 p8' },

    // ---------------------------------------------------------------- payments
    { id: 'n-era-eq', screen: tab('payments', 'era', 'era'), type: 'assumption', title: 'The reconciliation equation does not balance as written',
      body: 'V2 writes “Original charge − Allowed − Contractual adj. − Patient resp. = Paid”, which subtracts the allowed amount twice. The prototype checks Charge − Contractual = Allowed and Allowed − Patient responsibility = Paid.', q: ['Q-016'], ref: '§9.1 p11' },
    { id: 'n-era-sim', screen: tab('payments', 'era', 'era'), type: 'note', title: 'Remittances are simulated',
      body: 'No payer feed is connected; detailed 835 handling waits on clearinghouse access. Generate one from the simulators (Alt + Shift + S).', q: ['Q-018'], ref: '§9.2 p11' },
    { id: 'n-era-allowed', screen: tab('payments', 'era', 'era'), type: 'assumption', title: 'Where the allowed amount comes from',
      body: 'V2 removed the stored allowed amount, so nothing says what a payer should allow. The simulated payer uses its own contract rate; only the remittance states the allowed amount.', q: ['Q-075'], ref: '§10.3 p17' },
    { id: 'n-bt-balance', screen: tab('payments', 'era', 'batches'), type: 'question', title: 'A batch that does not balance',
      body: 'V2 requires check rows to balance to the check amount but does not say what happens when they do not. The prototype refuses to post until they balance.', q: ['Q-045'], ref: '§10.5 p22' },
    { id: 'n-led-rev', screen: tab('payments', 'era', 'ledger'), type: 'assumption', title: 'Corrections are posted, not deleted',
      body: 'V2 allows positive amounts only, yet reversals must be possible. A reversal is posted here as its own row that restores the balance.', q: ['C-011'], ref: '§10.5 p22 · §10.6 pp22–23' },

    // ---------------------------------------------------------------- denials & A/R
    { id: 'n-den-scope', screen: inSection('denials'), type: 'note', title: 'Denial management is not specified yet',
      body: 'V2 lists it as in scope. This queue uses only what the PRD and data model state: CARC/RARC codes, four statuses, three work types and the ownership fields.', q: ['Q-048', 'Q-001'], ref: 'ch. 11 p24 · §10.5 p22' },
    { id: 'n-ar-sla', screen: inSection('ar'), type: 'assumption', title: 'The SLA engine runs on demand',
      body: 'Nothing runs on a timer in the prototype. The check is triggered from the simulators, and escalated claims get an owner, priority, due date and next action.', q: ['Q-027'], ref: '§9.2 p11' },
    { id: 'n-ar-clone', screen: inSection('ar'), type: 'question', title: 'What “cloned into Denial & A/R” means',
      body: 'V2 escalates unpaid and denied claims into this module without saying whether a new record is created, or what links it back to the claim.', q: ['Q-028'], ref: '§9.2 p11' },

    // ---------------------------------------------------------------- reports & month end
    { id: 'n-rep', screen: inSection('reports'), type: 'note', title: 'Example reports',
      body: 'Analytics and reports are in scope but not specified. These six are illustrations computed from this session’s data, to help decide what the first release needs.', q: ['Q-050'], ref: 'ch. 11 p24' },
    { id: 'n-me', screen: at('month-end'), type: 'question', title: 'What closing a period actually does',
      body: 'V2 only says a period can be closed and that a Practice Admin cannot reopen one. Whether posting into a closed period is blocked is not stated; the prototype does not block it.', q: ['Q-049'], ref: '§10.6 p23' },
    { id: 'n-me-open', screen: at('month-end'), type: 'assumption', title: 'Where the first period comes from',
      body: 'V2 does not say how accounting periods are created. A new practice starts with the current month open, and closing a period opens the next.', q: ['Q-085'], ref: '§10.6 p23' },

    // ---------------------------------------------------------------- admin
    { id: 'n-adm-prac', screen: at('admin', 'practices'), type: 'note', title: 'A practice always has a primary location',
      body: 'V2 makes one mandatory at account creation, so the practice and its first location are created together. The practice is labelled “Company” in the sidebar, as the data model names it.', q: ['C-010'], ref: '§1.1–1.2 p2' },
    { id: 'n-adm-org', screen: at('admin', 'practices'), anchor: '[data-section="organization"]', type: 'question', title: 'What does the organization change?',
      body: 'A System Admin now creates organizations and groups practices into them (agreed in the meeting). V2 still does not say what the grouping changes beyond cross-practice reports — for example whether it drives an Organization Admin’s access.', q: ['Q-032'], ref: '§10.2 p13' },
    { id: 'n-adm-prac-fresh', screen: fresh(at('admin', 'practices')), type: 'assumption', title: 'The first account and the first practice',
      body: 'V2 seeds two roles and says nothing about how the first user is created. A new installation here has one System Administrator, who creates the first practice.', q: ['Q-086'], ref: '§10.2 p14' },
    { id: 'n-adm-orgs-tab', screen: at('admin', 'organizations'), type: 'assumption', title: 'A practice belongs to at most one organization',
      body: 'V2 gives the practice a single optional company, so a practice ticked into one organization leaves the other. Whether an owner needs nested or overlapping groups is not stated.', q: ['Q-032'], ref: '§10.2 p13' },
    { id: 'n-adm-codes-mod', screen: at('admin', 'codes'), anchor: '[name="defaultModifier2"]', type: 'assumption', title: 'A second default modifier',
      body: 'Agreed in the meeting: codes carry two default modifiers, both copied onto a new charge line. V2’s data model has a single default_modifier column.', ref: '§10.3 p17' },
    { id: 'n-adm-rules-scope', screen: at('admin', 'rules'), type: 'assumption', title: 'Rules can target an insurance class',
      body: 'Agreed in the meeting. V2 names default and payer-specific rules only, so the precedence is assumed: the payer’s own rule wins, then its class rule, then the default — the order V2 uses for billing rules.', q: ['Q-097'], ref: '§6.1 p7' },
    { id: 'n-adm-prov-hold', screen: at('admin', 'providers'), type: 'assumption', title: 'What a provider hold covers',
      body: 'V2 has one date and delays every visit before it. Here a hold runs between two dates and stops both billing and submission for the locations and payers it names — none named means all of them. After the end date the work flows normally.', q: ['Q-087', 'Q-062'], ref: '§10.3 p15' },
    { id: 'n-adm-users', screen: at('admin', 'users'), type: 'note', title: 'Clinicians are not users',
      body: 'They exist as provider profiles and never sign in. Service accounts, such as the EMR import, are users that cannot sign in interactively.', ref: '§1.3 p2 · §10.2 p13' },
    { id: 'n-adm-roles', screen: at('admin', 'roles'), type: 'question', title: 'Two permission models in one PRD',
      body: 'Chapter 1 sets Edit / View / Hidden per user and per section, down to single fields; chapter 10 stores create / read / update / delete per role and module. This matrix maps Edit to C R U (+ D), View to R, Hidden to none.', q: ['C-001'], ref: '§1.4 p3 · §10.2 p14' },
    { id: 'n-adm-int', screen: at('admin', 'integration'), type: 'question', title: 'Who approves an integration request',
      body: 'V2 has a Domain Admin raise the request but never says who approves it. A System Admin or Organization Admin approves here.', q: ['Q-029'], ref: '§2.2 p3' },
    { id: 'n-adm-int2', screen: at('admin', 'integration'), type: 'question', title: 'Changing a location back to EMR-only',
      body: 'New payloads are blocked, but V2 does not say what happens to charges and claims already in billing. They are left unchanged.', q: ['Q-030'], ref: '§2.3 p3' },
    { id: 'n-adm-prov', screen: at('admin', 'providers'), anchor: '[data-enr]', type: 'assumption', title: 'Payer enrollment is a prototype addition',
      body: 'The credentialing check needs it, but V2’s data model has no enrollment table. Status and effective date per payer are kept on the provider.', q: ['Q-010'], ref: '§6.2 p7 · §10.3 p15' },
    { id: 'n-adm-cls', screen: at('admin', 'classes'), type: 'assumption', title: 'When a changed class rule takes effect',
      body: 'Insurances inherit class values unless they override them, but V2 does not say what happens to claims already in progress. A change applies at each claim’s next scrub.', q: ['Q-081'], ref: '§10.3 pp15–16' },
    { id: 'n-adm-ins-audit', screen: at('admin', 'insurances'), type: 'assumption', title: 'What “Audit required” does',
      body: 'V2 has no such flag. A payer marked Audit required stops its claims in an Audit hold after scrubbing; a reviewer records which documents were attached, and only then is the claim submitted.', q: ['Q-089'], ref: '§6.2 p7' },
    { id: 'n-adm-ins', screen: at('admin', 'insurances'), anchor: '[name="slaDays"]', type: 'assumption', title: 'Three settings with no column in V2',
      body: 'Unit caps, SLA days and claim format are referenced by the scrubbing and A/R chapters but have no field in the data model. They are stored on the insurance here.', q: ['Q-011', 'Q-040'], ref: '§6.2 p7 · §9.2 p11' },
    { id: 'n-adm-bkt', screen: at('admin', 'buckets'), type: 'assumption', title: 'Deactivating a bucket',
      body: 'V2 does not say what happens to the insurances assigned to it or the claims waiting in it. Both are left in place.', q: ['Q-077'], ref: '§10.3 pp16–17' },
    { id: 'n-adm-codes', screen: at('admin', 'codes'), type: 'assumption', title: 'Who maintains the shared code list',
      body: 'Procedure codes are shared reference data “not owned by a practice”, but V2 does not say who maintains them. Only System Admin can edit them here.', q: ['Q-066'], ref: '§10.3 p17' },
    { id: 'n-adm-codes-fresh', screen: fresh(at('admin', 'codes')), type: 'question', title: 'Does a new installation come with codes?',
      body: 'V2 does not say whether CPT / HCPCS codes, a default fee schedule or insurance classes are delivered with the system. A Fresh System starts with none.', q: ['Q-085'], ref: '§3.4 p4 · §10.3 p17' },
    { id: 'n-adm-fees', screen: at('admin', 'fees'), type: 'question', title: 'Pricing per code is not modelled',
      body: 'V2 mentions pricing per unit or per code, but the fee schedule stores a price per unit only. Every line here is priced per unit.', q: ['Q-020'], ref: '§3.4 p4 · §10.3 p17' },
    { id: 'n-adm-ref', screen: at('admin', 'referrers'), type: 'question', title: 'Referring or supervising, not both',
      body: 'A physician is typed DN or DQ, but a case and a claim hold only one. A visit needing both has nowhere to record the second.', q: ['Q-078', 'C-006'], ref: '§10.3 p18 · §10.4 p19' },
    { id: 'n-adm-rules', screen: at('admin', 'rules'), type: 'question', title: '“Payment-posting grids” are undefined',
      body: 'V2 says coding rules also change payment-posting grids, without saying what those are. Rules here change the billing record only.', q: ['Q-013'], ref: '§6.1 p7' },
    { id: 'n-adm-auto', screen: at('admin', 'automation'), type: 'assumption', title: 'Automation is configured, not running',
      body: 'The interval, the AI check and the SLA source are stored and used, but nothing runs on a timer in the prototype. AI-predicted SLAs are named in V2 without any detail, so the option is disabled.', q: ['Q-041', 'Q-014'], ref: '§5.1 p6 · §9.2 p11' },
    { id: 'n-adm-audit', screen: at('admin', 'audit'), type: 'question', title: 'What the audit trail must record',
      body: 'V2 requires history on every item but does not define which events are kept, for how long, or who may read them.', q: ['Q-053'], ref: '§1.4 p3' },
  ]

  const forScreen = () => {
    const { parts, q } = R.parse()
    const p = parts.length ? parts : ['login']
    return NOTES.filter((n) => {
      try {
        return n.screen(p, q)
      } catch (e) {
        return false
      }
    })
  }
  return { NOTES, forScreen }
})()

// ================================================================ the annotation layer
const Review = (() => {
  const KEY = 'bs.reviewNotes'
  const TYPE = { assumption: 'Assumption', question: 'Client question', note: 'Note' }
  const read = () => {
    try {
      return localStorage.getItem(KEY) !== 'off'
    } catch (e) {
      return true
    }
  }
  const st = { on: read(), open: false, detail: null, menu: false }
  const esc = U.esc
  const save = () => {
    try {
      localStorage.setItem(KEY, st.on ? 'on' : 'off')
    } catch (e) {
      /* preference only */
    }
  }
  const root = () => {
    let el = document.getElementById('rn-root')
    if (!el) {
      el = document.createElement('div')
      el.id = 'rn-root'
      document.body.appendChild(el)
    }
    return el
  }
  const hidden = () => !st.on || !Env.current() || R.parse().parts[0] === 'welcome'
  const notes = () => (hidden() ? [] : ReviewNotes.forScreen())
  const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']
  /** marker number for a note, counting only notes whose element is on the page; null if none */
  const numberOf = (n, list) => {
    const shown = list.filter((x) => x.anchor && document.querySelector(x.anchor))
    const i = shown.indexOf(n)
    return i < 0 ? null : NUM[i] || String(i + 1)
  }

  const qLink = (id) => `<a class="rn-q" href="https://github.com/Abdelrahman-Mohamd/EMR-Billing/blob/main/PRD_CLARIFICATION_QUESTIONS.md" target="_blank" rel="noopener" title="Open the clarification register">${esc(id)}</a>`
  const detailHtml = (n, i) => `<div class="rn-detail">
      <button type="button" class="rn-back" data-act="rn.list">← All notes</button>
      <div class="rn-type rn-${n.type}">${TYPE[n.type]}</div>
      <h3>${numberOf(n, notes()) ? `<span class="rn-num-inline">${numberOf(n, notes())}</span>` : ''}${esc(n.title)}</h3>
      <p>${esc(n.body)}</p>
      <div class="rn-meta">${n.q && n.q.length ? `<div>${n.q.map(qLink).join(' · ')}</div>` : ''}${n.ref ? `<div>PRD V2 · ${esc(n.ref)}</div>` : ''}</div>
    </div>`
  const listHtml = (list) => {
    if (!list.length) return '<p class="rn-empty">No review notes for this screen.</p>'
    return `<ul class="rn-list">${list
      .map((n, i) => `<li><button type="button" data-act="rn.open" data-id="${n.id}"><span class="rn-num ${numberOf(n, list) ? '' : 'plain'}">${numberOf(n, list) || '–'}</span><span><span class="rn-t">${esc(n.title)}</span><span class="rn-type rn-${n.type}">${TYPE[n.type]}</span></span></button></li>`)
      .join('')}</ul>`
  }
  const panelHtml = (list) => {
    const n = st.detail ? list.find((x) => x.id === st.detail) : null
    return `<div class="rn-panel" role="dialog" aria-label="Review notes" data-demo="rn-panel">
      <div class="rn-head"><span>Review notes</span><span class="rn-where">${esc(screenLabel())}</span><button type="button" class="rn-x" data-act="rn.close" aria-label="Close">${I('x', 'icon-14')}</button></div>
      <div class="rn-body">${n ? detailHtml(n, list.indexOf(n)) : listHtml(list)}</div>
      <div class="rn-foot">
        <button type="button" data-act="rn.tools">Prototype…</button>
        <button type="button" data-act="rn.off">Hide notes</button>
      </div>
    </div>`
  }
  const screenLabel = () => {
    const { parts } = R.parse()
    if (!parts.length || parts[0] === 'login') return 'Sign in'
    const nav = NAV.find((x) => x.key === parts[0])
    const sub = parts[1] && !/^[a-z]+\d/i.test(parts[1]) ? ` · ${parts[1].replace(/-/g, ' ')}` : ''
    return (nav ? nav.label : parts[0]) + sub
  }
  const toolsHtml = () => {
    const other = Env.META[Env.isFresh() ? 'demo' : 'fresh']
    return `<div class="rn-panel rn-tools" role="menu">
      <div class="rn-head"><span>Prototype</span><button type="button" class="rn-x" data-act="rn.close" aria-label="Close">${I('x', 'icon-14')}</button></div>
      <div class="rn-body">
        <div class="rn-sec">Simulate an external event</div>
        ${Simulators.LIST.map((s) => `<button type="button" class="rn-tool" data-act="rn.sim" data-key="${s.key}" data-demo="rn-sim-${s.key}"><span>${esc(s.title)}</span><span class="rn-sub">${esc(s.stands)}</span></button>`).join('')}
        <div class="rn-sec">Data</div>
        <button type="button" class="rn-tool" data-act="env.switch" data-mode="${other.key}"><span>Switch to ${esc(other.label)}</span><span class="rn-sub">Resets this session</span></button>
        <button type="button" class="rn-tool" data-act="env.reset"><span>${Env.isFresh() ? 'Reset the Fresh System' : 'Reset the demo data'}</span><span class="rn-sub">Back to how it started</span></button>
        <button type="button" class="rn-tool" data-act="env.welcome"><span>Start screen</span><span class="rn-sub">Choose the environment again</span></button>
      </div>
    </div>`
  }

  // markers sit in their own overlay, so the application's markup is never touched
  const placeMarkers = (list) => {
    const layer = document.getElementById('rn-markers')
    const anchored = list.filter((n) => n.anchor && document.querySelector(n.anchor))
    layer.innerHTML = anchored
      .map((n, i) => `<button type="button" class="rn-marker" data-act="rn.open" data-id="${n.id}" data-i="${list.indexOf(n)}" title="Review note">${numberOf(n, list)}</button>`)
      .join('')
    position()
  }
  const position = () => {
    const layer = document.getElementById('rn-markers')
    if (!layer) return
    const list = notes()
    // while a dialog is open, only its own markers make sense
    const open = document.querySelector('#layers .layer, #layers .drawer-layer')
    Array.from(layer.children).forEach((m) => {
      const n = list.find((x) => x.id === m.dataset.id)
      const el = n && document.querySelector(n.anchor)
      if (el && open && !open.contains(el)) {
        m.style.display = 'none'
        return
      }
      if (!el) {
        m.style.display = 'none'
        return
      }
      const r = el.getBoundingClientRect()
      if (!r.width || r.bottom < 0 || r.top > window.innerHeight) {
        m.style.display = 'none'
        return
      }
      m.style.display = ''
      // beside the element, or just inside its right edge when there is no room
      const outside = r.right + 28 < window.innerWidth - 16
      m.style.left = `${outside ? r.right + 6 : Math.max(8, r.right - 28)}px`
      m.style.top = `${Math.max(4, r.top + Math.min(10, Math.max(0, r.height / 2 - 11)))}px`
    })
  }

  const paint = () => {
    const el = root()
    const list = notes()
    document.body.classList.toggle('rn-on', !hidden())
    if (hidden()) {
      el.innerHTML = ''
      return
    }
    el.innerHTML = `<div id="rn-markers" aria-hidden="true"></div>
      <button type="button" class="rn-btn ${st.open ? 'on' : ''}" data-act="rn.toggle" aria-expanded="${st.open}" data-demo="rn-button">Review notes${list.length ? ` · ${list.length}` : ''}</button>
      ${st.menu ? toolsHtml() : st.open ? panelHtml(list) : ''}`
    placeMarkers(list)
  }

  // ---------------------------------------------------------------- actions
  ACT['rn.toggle'] = () => {
    st.open = !st.open
    st.menu = false
    st.detail = null
    paint()
  }
  ACT['rn.close'] = () => {
    st.open = false
    st.menu = false
    st.detail = null
    paint()
  }
  ACT['rn.open'] = (el) => {
    st.detail = el.dataset.id
    st.open = true
    st.menu = false
    paint()
  }
  ACT['rn.list'] = () => {
    st.detail = null
    paint()
  }
  ACT['rn.tools'] = () => {
    st.menu = true
    st.open = false
    paint()
  }
  ACT['rn.sim'] = (el) => {
    st.menu = false
    paint()
    Simulators.run(el.dataset.key)
  }
  ACT['rn.off'] = () => {
    st.on = false
    st.open = false
    st.menu = false
    save()
    paint()
    UI.toast('info', 'Review notes hidden', 'Press Alt + Shift + N to show them again.')
  }
  ACT['rn.on'] = () => {
    st.on = true
    save()
    paint()
  }
  ACT['rn.pick'] = (el) => {
    st.on = el.checked
    save()
    paint()
  }

  document.addEventListener('click', (ev) => {
    if (!st.open && !st.menu) return
    if (ev.target.closest('.rn-panel, .rn-btn, .rn-marker')) return
    st.open = false
    st.menu = false
    paint()
  }, true)
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && (st.open || st.menu)) {
      st.open = false
      st.menu = false
      paint()
      return
    }
    if (!ev.altKey || !ev.shiftKey) return
    if (ev.code === 'KeyN') {
      ev.preventDefault()
      st.on = !st.on
      st.open = false
      save()
      paint()
    } else if (ev.code === 'KeyS') {
      ev.preventDefault()
      if (!Env.current() || !S.user()) return
      st.on = true
      st.menu = true
      st.open = false
      save()
      paint()
    }
  })
  window.addEventListener('scroll', position, true)
  window.addEventListener('resize', position)
  // a dialog can hold the element a note points at, so re-place the markers when one opens
  const layers = document.getElementById('layers')
  if (layers) new MutationObserver(() => paint()).observe(layers, { childList: true })

  return {
    sync: () => paint(),
    isOn: () => st.on,
    setOn: (v) => {
      st.on = v
      save()
      paint()
    },
    count: () => notes().length,
  }
})()
