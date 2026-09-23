/* Shared by both prototype environments (see environment.js). */

/** CRUD flags per permission module from a spec such as { PATIENT: 'CRUD' } or '*'. */
function rolePermissions(spec) {
  const out = {}
  MODULES.forEach((m) => {
    const s = spec === '*' ? 'CRUD' : spec[m.key] || ''
    out[m.key] = { c: s.includes('C'), r: s.includes('R'), u: s.includes('U'), d: s.includes('D') }
  })
  return out
}

/** The only records PRD V2 says exist by default: "Two roles are seeded: System Admin
 *  (all modules, all flags, every practice) and Practice Admin (see §10.6)" — §10.2 p14. */
function v2SeededRoles() {
  return [
    { id: 'r1', code: 'SYSTEM_ADMIN', name: 'System Admin', isGlobal: true, seeded: true, permissions: rolePermissions('*'), description: 'All modules, all flags, every practice.' },
    { id: 'r2', code: 'PRACTICE_ADMIN', name: 'Practice Admin', isGlobal: false, seeded: true, permissions: rolePermissions({ DASHBOARD: 'R', PATIENT: 'CRUD', CHARGES: 'CRUD', BILLING: 'CRU', PAYMENTS: 'CRU', DENIALS: 'CRU', AR: 'CRU', REPORTS: 'R', MONTHEND: 'CR', ADMIN: 'CRU', INTEGRATION: 'R' }), description: 'Runs billing for the practices granted to the user.' },
  ]
}

/** Industry-standard code sets the pickers draw from (ICD-10 diagnoses, CARC/RARC
 *  adjustment codes). They are not practice records and have no table in PRD V2;
 *  both environments load them (prototype assumption A-P47, Q-085). */
function referenceCodeLists() {
  const icd10 = [
    ['M54.50', 'Low back pain, unspecified'], ['M54.2', 'Cervicalgia'], ['M25.511', 'Pain in right shoulder'],
    ['M25.512', 'Pain in left shoulder'], ['M25.561', 'Pain in right knee'], ['M25.562', 'Pain in left knee'],
    ['M75.101', 'Unspecified rotator cuff tear of right shoulder, not traumatic'], ['M75.41', 'Impingement syndrome of right shoulder'],
    ['S83.511D', 'Sprain of anterior cruciate ligament of right knee, subsequent encounter'], ['S93.401D', 'Sprain of unspecified ligament of right ankle, subsequent encounter'],
    ['S13.4XXD', 'Sprain of ligaments of cervical spine, subsequent encounter'], ['S33.5XXD', 'Sprain of ligaments of lumbar spine, subsequent encounter'],
    ['M17.11', 'Unilateral primary osteoarthritis, right knee'], ['M17.12', 'Unilateral primary osteoarthritis, left knee'],
    ['M62.81', 'Muscle weakness (generalized)'], ['R26.89', 'Other abnormalities of gait and mobility'], ['R26.2', 'Difficulty in walking'],
    ['Z96.652', 'Presence of left artificial knee joint'], ['Z47.1', 'Aftercare following joint replacement surgery'],
    ['M51.26', 'Other intervertebral disc displacement, lumbar region'], ['S92.352D', 'Displaced fracture of fifth metatarsal bone, left foot, subsequent encounter'],
    ['M76.61', 'Achilles tendinitis, right leg'], ['M72.2', 'Plantar fascial fibromatosis'], ['M79.641', 'Pain in right hand'],
    ['G89.29', 'Other chronic pain'], ['S46.011D', 'Strain of muscle and tendon of rotator cuff of right shoulder, subsequent encounter'],
  ].map(([code, desc]) => ({ code, desc }))
  const carc = [
    ['CO-45', 'Charge exceeds fee schedule / maximum allowable'], ['CO-97', 'Service included in the allowance for another service'],
    ['CO-16', 'Claim lacks information needed for adjudication'], ['CO-50', 'Not deemed a medical necessity by the payer'],
    ['CO-197', 'Precertification / authorization absent'], ['CO-29', 'The time limit for filing has expired'],
    ['CO-18', 'Exact duplicate claim / service'], ['CO-204', 'Service not covered under the patient’s current benefit plan'],
    ['PR-1', 'Deductible amount'], ['PR-2', 'Coinsurance amount'], ['PR-3', 'Co-payment amount'], ['OA-23', 'Impact of prior payer adjudication'],
  ].map(([code, desc]) => ({ code, desc }))
  const rarc = [
    ['N54', 'Claim information is inconsistent with pre-certified / authorized services'], ['M127', 'Missing patient medical record for this service'],
    ['MA130', 'Claim contains incomplete and/or invalid information'], ['N130', 'Consult plan benefit documents'],
  ].map(([code, desc]) => ({ code, desc }))
  return { icd10, carc, rarc }
}

/* Seed data — realistic but fictional. Every name, NPI, member ID and phone
   number here is invented (phones use the 555 range). `buildSeed()` runs on
   load and on "Reset demo data"; nothing is persisted. */

function buildSeed() {
  const TODAY = '2026-09-15'
  const db = {
    today: TODAY,
    companies: [], practices: [], locations: [], roles: [], users: [], providers: [], insuranceClasses: [], insurances: [],
    releaseBuckets: [], procedureCodes: [], feeSchedules: [], payerContracts: [], referrers: [], patients: [], cases: [], coverages: [],
    authorizations: [], visits: [], chargeLines: [], claims: [], payments: [], batches: [], eras: [],
    denials: [], exceptions: [], updates: [], runs: [], periods: [], codingRules: [], audit: [],
    emrLog: [], icd10: [], carc: [], rarc: [],
    settings: { schedule: 'daily-18', scheduleOptions: [{ id: 'hourly', label: 'Every hour', kind: 'hours', hours: 1, time: null }, { id: '4h', label: 'Every 4 hours', kind: 'hours', hours: 4, time: null }, { id: 'daily-18', label: 'Every day at 18:00', kind: 'daily', hours: null, time: '18:00' }], aiCoding: true, slaSource: 'manual', lastScheduledRun: '2026-09-14T18:00' },
  }
  DB = db
  S.quiet = true
  S.session.userId = 'u8'

  const at = (iso, hm = '09:00') => `${iso}T${hm}`
  const A = (iso, hm, userId, action, module, entityType, entityId, detail = '', practiceId = 'pr1') =>
    db.audit.push({ id: U.id('au'), at: at(iso, hm), userId, action, module, entityType, entityId, detail, practiceId })

  // ------------------------------------------------------------ organization
  db.companies.push({ id: 'co1', name: 'Harborline Rehab Group', isActive: true })
  db.practices.push(
    { id: 'pr1', companyId: 'co1', code: 'HPT1', name: 'Harborline Physical Therapy', legalName: 'Harborline Physical Therapy, PLLC', dba: 'Harborline PT', npi: '1609847312', taxId: '84-2217765', taxIdType: 'EIN', taxonomy: '225100000X', address: { line1: '8622 5th Avenue, Suite 2', line2: '', city: 'Brooklyn', state: 'NY', zip: '11209' }, phone: '718-555-0100', isActive: true },
    { id: 'pr2', companyId: 'co1', code: 'NSS2', name: 'Northgate Sports & Spine', legalName: 'Northgate Sports & Spine Physical Therapy, P.C.', dba: '', npi: '1710958423', taxId: '87-4410932', taxIdType: 'EIN', taxonomy: '225100000X', address: { line1: '45 Northern Boulevard', line2: 'Floor 3', city: 'Great Neck', state: 'NY', zip: '11021' }, phone: '516-555-0190', isActive: true },
  )
  db.locations.push(
    { id: 'L1', practiceId: 'pr1', code: 'BR003', name: 'Bay Ridge', npi: '1609847312', address: { line1: '8622 5th Avenue, Suite 2', city: 'Brooklyn', state: 'NY', zip: '11209' }, pos: '11', isPrimary: true, isActive: true, emr: { uniqueLocationId: 'EMR-LOC-4471', link: 'Linked', election: 'Integrated', linkedOn: '2025-11-03', requestedBy: 'u4' } },
    { id: 'L2', practiceId: 'pr1', code: 'PS002', name: 'Park Slope', npi: '1821069534', address: { line1: '214 7th Avenue', city: 'Brooklyn', state: 'NY', zip: '11215' }, pos: '11', isPrimary: false, isActive: true, emr: { uniqueLocationId: 'EMR-LOC-4472', link: 'Linked', election: 'Integrated', linkedOn: '2025-11-03', requestedBy: 'u4' } },
    { id: 'L3', practiceId: 'pr1', code: 'SI004', name: 'Staten Island Annex', npi: '1932170645', address: { line1: '1200 Richmond Road', city: 'Staten Island', state: 'NY', zip: '10304' }, pos: '11', isPrimary: false, isActive: true, emr: { uniqueLocationId: 'EMR-LOC-4480', link: 'Requested', election: 'EMR only', requestedOn: '2026-09-11', requestedBy: 'u4' } },
    { id: 'L4', practiceId: 'pr2', code: 'NG001', name: 'Northgate Main', npi: '1710958423', address: { line1: '45 Northern Boulevard, Floor 3', city: 'Great Neck', state: 'NY', zip: '11021' }, pos: '11', isPrimary: true, isActive: true, emr: { uniqueLocationId: 'EMR-LOC-5120', link: 'Linked', election: 'Integrated', linkedOn: '2026-02-17', requestedBy: 'u1' } },
  )

  // ------------------------------------------------------------ roles & users (§1.3, §10.2, §10.6)
  const perm = rolePermissions
  db.roles.push(
    ...v2SeededRoles(),
    { id: 'r3', code: 'ORG_ADMIN', name: 'Organization Admin', isGlobal: false, permissions: perm('*'), description: 'All modules across the organization’s practices.' },
    { id: 'r4', code: 'DOMAIN_ADMIN', name: 'Domain Admin', isGlobal: false, permissions: perm({ DASHBOARD: 'R', ADMIN: 'R', INTEGRATION: 'CRU' }), description: 'Requests EMR integration for locations and chooses which locations bill through the platform.' },
    { id: 'r5', code: 'BILLING_VIEWER', name: 'Billing Viewer', isGlobal: false, custom: true, permissions: perm({ DASHBOARD: 'R', PATIENT: 'R', CHARGES: 'R', BILLING: 'R', PAYMENTS: 'R', DENIALS: 'R', AR: 'R', REPORTS: 'R' }), description: 'Example custom role: View on billing modules, Hidden on Admin and Month End.' },
    { id: 'r6', code: 'EMR_SERVICE', name: 'EMR import (service)', isGlobal: false, custom: true, permissions: perm({ PATIENT: 'CRU', CHARGES: 'CRU' }), description: 'Service account role used by the EMR ingestion pipeline.' },
  )
  db.users.push(
    { id: 'u1', username: 'dwhitfield', displayName: 'Dana Whitfield', email: 'dana.whitfield@harborline.example', isServiceAccount: false, defaultPracticeId: 'pr1', isActive: true, roleIds: ['r1'], grants: [] },
    { id: 'u2', username: 'rcastillo', displayName: 'Renee Castillo', email: 'renee.castillo@harborline.example', isServiceAccount: false, defaultPracticeId: 'pr1', isActive: true, roleIds: ['r3'], grants: [{ practiceId: 'pr1', locationIds: [] }, { practiceId: 'pr2', locationIds: [] }] },
    { id: 'u3', username: 'therrera', displayName: 'Tomás Herrera', email: 'tomas.herrera@harborline.example', isServiceAccount: false, defaultPracticeId: 'pr1', isActive: true, roleIds: ['r2'], grants: [{ practiceId: 'pr1', locationIds: [] }] },
    { id: 'u4', username: 'ibennett', displayName: 'Ivy Bennett', email: 'ivy.bennett@harborline.example', isServiceAccount: false, defaultPracticeId: 'pr1', isActive: true, roleIds: ['r4'], grants: [{ practiceId: 'pr1', locationIds: [] }] },
    { id: 'u5', username: 'opark', displayName: 'Owen Park', email: 'owen.park@harborline.example', isServiceAccount: false, defaultPracticeId: 'pr1', isActive: true, roleIds: ['r5'], grants: [{ practiceId: 'pr1', locationIds: ['L1'] }] },
    { id: 'u6', username: 'kmorgan', displayName: 'Keisha Morgan', email: 'keisha.morgan@harborline.example', isServiceAccount: false, defaultPracticeId: 'pr1', isActive: true, roleIds: ['r2'], grants: [{ practiceId: 'pr1', locationIds: ['L1', 'L2'] }] },
    { id: 'u7', username: 'asiddiqui', displayName: 'Ahmed Siddiqui', email: 'ahmed.siddiqui@northgate.example', isServiceAccount: false, defaultPracticeId: 'pr2', isActive: true, roleIds: ['r2'], grants: [{ practiceId: 'pr2', locationIds: [] }] },
    { id: 'u8', username: 'svc-emr-import', displayName: 'EMR import (service)', email: '', isServiceAccount: true, defaultPracticeId: 'pr1', isActive: true, roleIds: ['r6'], grants: [{ practiceId: 'pr1', locationIds: [] }, { practiceId: 'pr2', locationIds: [] }] },
    { id: 'u9', username: 'svc-data-conversion', displayName: 'Data conversion (service)', email: '', isServiceAccount: true, defaultPracticeId: 'pr1', isActive: false, roleIds: ['r6'], grants: [{ practiceId: 'pr1', locationIds: [] }] },
  )

  // ------------------------------------------------------------ reference lists
  Object.assign(db, referenceCodeLists())

  // CPT / HCPCS — shared reference data, not owned by a practice (§10.3)
  ;[
    ['97161', 'PT evaluation, low complexity', false, 'GP', 120], ['97162', 'PT evaluation, moderate complexity', false, 'GP', 140],
    ['97163', 'PT evaluation, high complexity', false, 'GP', 160], ['97164', 'PT re-evaluation', false, 'GP', 90],
    ['97110', 'Therapeutic exercise', true, 'GP', 35], ['97112', 'Neuromuscular re-education', true, 'GP', 38],
    ['97116', 'Gait training', true, 'GP', 32], ['97140', 'Manual therapy techniques', true, 'GP', 34],
    ['97530', 'Therapeutic activities', true, 'GP', 40], ['97535', 'Self-care / home management training', true, 'GP', 36],
    ['97035', 'Ultrasound therapy', true, 'GP', 18], ['97010', 'Hot or cold packs', false, 'GP', 12],
    ['97014', 'Electrical stimulation, unattended', false, 'GP', 16], ['G0283', 'Electrical stimulation, unattended (Medicare)', false, 'GP', 16],
    ['97750', 'Physical performance test', true, 'GP', 45], ['97033', 'Iontophoresis', true, 'GP', 0],
    ['97039', 'Unlisted modality (retired locally)', false, 'GP', 20],
  ].forEach(([code, description, isTimed, mod, fee]) =>
    db.procedureCodes.push({
      id: `pc${code}`, code, description, isTimed, defaultModifier: mod, defaultModifier2: '', defaultFee: fee,
      // procedure_type and is_active are new in PRD V2 §10.3 (CH-13)
      procedureType: /^9716/.test(code) || code === '97750' ? 'Evaluation' : ['97010', '97014', 'G0283', '97035', '97033', '97039'].includes(code) ? 'Modality' : 'Therapeutic',
      isActive: code !== '97039', isNew: code === '97033', addedOn: code === '97033' ? '2026-09-14' : '2024-01-01',
    }),
  )

  // ------------------------------------------------------------ insurance classes (PRD V2 §10.3, CH-02)
  // A class carries the default of every billing rule; its insurances inherit them.
  const icls = (o) => db.insuranceClasses.push({ practiceId: 'pr1', authRequired: false, injuryDateRequired: false, specialtyModifiers: true, acceptAssignment: true, icdVersion: 'ICD10', isActive: true, ...o })
  icls({ id: 'ic1', code: 'MED', name: 'Medicare' })
  icls({ id: 'ic2', code: 'BS', name: 'Blue Shield', authRequired: true })
  icls({ id: 'ic3', code: 'COM', name: 'Commercial' })
  icls({ id: 'ic4', code: 'WC', name: "Worker's Comp", authRequired: true, injuryDateRequired: true })
  icls({ id: 'ic5', code: 'AUTO', name: 'Auto / No-Fault', injuryDateRequired: true })
  icls({ id: 'ic6', code: 'MG', name: 'Medicare Supplement', specialtyModifiers: false })
  icls({ id: 'ic7', code: 'MED', name: 'Medicare', practiceId: 'pr2' })
  icls({ id: 'ic8', code: 'COM', name: 'Commercial', practiceId: 'pr2' })

  // ------------------------------------------------------------ release buckets (PRD V2 §6.2, §10.3, CH-01/CH-03)
  db.releaseBuckets.push(
    { id: 'rb1', practiceId: 'pr1', name: 'Manual Release – Auto / No-Fault', description: 'No-fault carriers: attach the NF-3 before release.', isActive: true, createdBy: 'u3', createdOn: '2026-08-02' },
    { id: 'rb2', practiceId: 'pr1', name: 'Manual Release – WC Payers', description: 'Workers’ comp carriers that want a review before each claim.', isActive: true, createdBy: 'u3', createdOn: '2026-08-02' },
    { id: 'rb3', practiceId: 'pr1', name: 'Legacy review queue', description: 'Retired August 2026.', isActive: false, createdBy: 'u1', createdOn: '2026-01-10' },
    { id: 'rb4', practiceId: 'pr2', name: 'Manual Release – Northgate', description: '', isActive: true, createdBy: 'u7', createdOn: '2026-08-20' },
  )

  // ------------------------------------------------------------ insurances (§10.3)
  // Billing rules are null = "inherit from the class"; a value overrides the class for this insurance only.
  const insu = (o) => db.insurances.push({ auditRequired: false, phone: '800-555-0100', fax: '800-555-0199', icdVersion: null, acceptAssignment: null, specialtyModifiers: null, authRequired: null, injuryDateRequired: null, insuranceHold: false, releaseBucketId: null, maxUnits: 6, slaDays: 30, format: '837P', portalUrl: 'https://provider.example-payer.com', portalUser: 'harborline_billing', portalPassword: 'Tr1dent-Harbor-26', isActive: true, draft: false, practiceId: 'pr1', ...o })
  insu({ id: 'i1', code: 1001, name: 'Medicare Part B', classId: 'ic1', type: 'Medicare', payerId: '13202', address: { line1: 'PO Box 6178', city: 'Indianapolis', state: 'IN', zip: '46206' }, maxUnits: 4, slaDays: 14, portalUrl: 'https://portal.example-medicare.gov' })
  insu({ id: 'i2', code: 1002, name: 'Empire BlueCross BlueShield', classId: 'ic2', type: 'Commercial', payerId: '803', address: { line1: 'PO Box 1407, Church Street Station', city: 'New York', state: 'NY', zip: '10008' } })
  insu({ id: 'i3', code: 1003, name: 'Aetna', classId: 'ic3', type: 'Commercial', payerId: '60054', address: { line1: 'PO Box 981106', city: 'El Paso', state: 'TX', zip: '79998' } })
  insu({ id: 'i4', code: 1004, name: 'UnitedHealthcare', classId: 'ic3', type: 'Commercial', payerId: '87726', address: { line1: 'PO Box 30555', city: 'Salt Lake City', state: 'UT', zip: '84130' }, authRequired: true, maxUnits: 4 })
  insu({ id: 'i5', code: 1039, name: 'Corvel Enterprise', classId: 'ic4', type: 'Workers Comp', payerId: 'CORVEL', address: { line1: 'PO Box 7600', city: 'Portland', state: 'OR', zip: '97208' }, format: 'CMS1500', slaDays: 45 })
  insu({ id: 'i6', code: 1050, name: 'GEICO No-Fault', classId: 'ic5', type: 'PIP', payerId: 'GEICO', address: { line1: 'PO Box 9091', city: 'Macon', state: 'GA', zip: '31208' }, insuranceHold: true, releaseBucketId: 'rb1', format: 'CMS1500', slaDays: 45 })
  insu({ id: 'i7', code: 1006, name: 'Cigna', classId: 'ic3', type: 'Commercial', payerId: '62308', address: { line1: 'PO Box 188061', city: 'Chattanooga', state: 'TN', zip: '37422' } })
  insu({ id: 'i8', code: 1008, name: 'AARP Medicare Supplement', classId: 'ic6', type: 'Commercial', payerId: '36273', address: { line1: 'PO Box 740819', city: 'Atlanta', state: 'GA', zip: '30374' } })
  insu({ id: 'i9', code: null, name: 'Oscar Health', classId: null, type: '', payerId: '', address: { line1: '', city: '', state: '', zip: '' }, draft: true, draftFrom: 'EMR session on 09/14/2026', portalUrl: '', portalUser: '', portalPassword: '' })
  insu({ id: 'i10', code: 2001, name: 'Medicare Part B', classId: 'ic7', type: 'Medicare', payerId: '13202', address: { line1: 'PO Box 6178', city: 'Indianapolis', state: 'IN', zip: '46206' }, maxUnits: 4, slaDays: 14, practiceId: 'pr2' })
  insu({ id: 'i11', code: 2002, name: 'Aetna', classId: 'ic8', type: 'Commercial', payerId: '60054', address: { line1: 'PO Box 981106', city: 'El Paso', state: 'TX', zip: '79998' }, practiceId: 'pr2' })

  // Fee schedules hold the BILLED price per unit only (PRD V2 §10.3, CH-08).
  // The second number is what each payer allows. It is NOT billing-system data:
  // it lives in `payerContracts`, which only the simulated payer (ERA simulator) reads.
  const fees = {
    i1: { 97110: [30, 29.64], 97112: [34, 33.5], 97116: [29, 28.7], 97140: [28, 27.2], 97530: [36, 35.9], 97535: [32, 31.5], G0283: [16, 12.8], 97161: [105, 101.3], 97162: [105, 101.3], 97163: [105, 101.3], 97164: [72, 70.1], 97750: [38, 36.2] },
    i2: { 97110: [40, 32], 97112: [42, 34], 97116: [38, 30], 97140: [40, 31], 97530: [45, 36], 97161: [150, 115], 97162: [150, 115] },
    i3: { 97110: [38, 30.5], 97112: [40, 32.6], 97140: [38, 29.8], 97530: [42, 34.1], 97535: [38, 30.2], 97162: [145, 110] },
    i4: { 97110: [36, 29.1], 97112: [38, 31], 97140: [36, 28.4], 97530: [40, 33.2], 97161: [140, 105] },
    i5: { 97110: [48, 44], 97112: [50, 45], 97140: [46, 42], 97530: [52, 47], 97163: [190, 170], 97750: [60, 55] },
    i6: { 97110: [45, 40.5], 97140: [44, 39], 97530: [50, 45], 97162: [170, 150], 97014: [22, 19] },
    i10: { 97110: [30, 29.64], 97140: [28, 27.2], 97530: [36, 35.9], 97116: [29, 28.7] },
    i11: { 97110: [38, 30.5], 97140: [38, 29.8], 97530: [42, 34.1] },
  }
  Object.entries(fees).forEach(([insId, rows]) =>
    Object.entries(rows).forEach(([code, [billed, allowed]]) => {
      db.feeSchedules.push({ id: U.id('fs'), insuranceId: insId, procedureCodeId: `pc${code}`, billed, from: '2026-01-01', to: '2026-12-31' })
      db.payerContracts.push({ insuranceId: insId, procedureCodeId: `pc${code}`, allowed })
    }),
  )

  // Coding rules (§6.1)
  db.codingRules.push(
    { id: 'cr1', type: 'Replace', fromCode: '97014', toCode: 'G0283', scope: 'i1', active: true, note: 'Medicare requires G0283 for unattended e-stim.' },
    { id: 'cr2', type: 'Drop', fromCode: '97010', toCode: '', scope: 'default', active: true, note: 'Hot/cold packs are bundled for most payers.' },
    { id: 'cr3', type: 'Replace', fromCode: '97014', toCode: 'G0283', scope: 'i10', active: true, note: 'Northgate Medicare contract.' },
    { id: 'cr4', type: 'Drop', fromCode: '97035', toCode: '', scope: 'i4', active: false, note: 'Paused — UHC ultrasound policy under review.' },
  )

  // ------------------------------------------------------------ providers & referrers
  const allActive = (ids, status = 'Active') => ids.map((insuranceId) => ({ insuranceId, status, effective: '2024-01-01' }))
  const PR1_INS = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8']
  const prov = (o) => db.providers.push({ practiceId: 'pr1', taxonomy: '225100000X', specialty: 'PHYSICAL THERAPIST', claimHoldFrom: null, claimHoldUntil: null, claimHoldReason: '', claimHoldLocations: [], claimHoldInsurances: [], isActive: true, draft: false, enrollments: allActive(PR1_INS), ...o })
  prov({ id: 'P1', code: '297', firstName: 'Aisha', lastName: 'Rahman', credential: 'PT, DPT', npi: '1356482917', stateLicense: 'NY 041822' })
  prov({ id: 'P2', code: '301', firstName: 'Marcus', lastName: 'Delaney', credential: 'PT', npi: '1467593028', stateLicense: 'NY 043517', enrollments: [...allActive(['i1', 'i2', 'i3', 'i5', 'i6', 'i7', 'i8']), { insuranceId: 'i4', status: 'Pending', effective: null }] })
  prov({ id: 'P3', code: '305', firstName: 'Elena', lastName: 'Petrova', credential: 'PT, DPT', npi: '1578604139', stateLicense: 'NY 044902' })
  prov({ id: 'P4', code: '318', firstName: 'Jordan', lastName: 'Okafor', credential: 'PT', npi: '1689715240', stateLicense: 'NY 047731', claimHoldFrom: '2026-09-01', claimHoldUntil: '2026-09-30', claimHoldReason: 'Pending Provider Credentialing', enrollments: allActive(PR1_INS, 'Pending').map((e) => ({ ...e, effective: null })) })
  prov({ id: 'P5', code: '322', firstName: 'Sofia', lastName: 'Marchetti', credential: 'OTR/L', npi: '1790826351', stateLicense: 'NY 012290', taxonomy: '225X00000X', specialty: 'OCCUPATIONAL THERAPIST' })
  prov({ id: 'P6', code: 'EMR-7781', firstName: 'Liam', lastName: 'Chen', credential: '', npi: '', stateLicense: '', taxonomy: '', draft: true, draftFrom: 'First finalized EMR note on 09/14/2026', enrollments: [] })
  prov({ id: 'P9', code: '327', firstName: 'Caleb', lastName: 'Wright', credential: 'PT', npi: '', stateLicense: 'NY 048115' })
  prov({ id: 'P7', practiceId: 'pr2', code: '110', firstName: 'Noah', lastName: 'Feldman', credential: 'PT, DPT', npi: '1801937462', stateLicense: 'NY 039981', enrollments: allActive(['i10', 'i11']) })
  prov({ id: 'P8', practiceId: 'pr2', code: '112', firstName: 'Grace', lastName: 'Liu', credential: 'PT', npi: '1912048573', stateLicense: 'NY 040377', enrollments: allActive(['i10', 'i11']) })

  const refr = (o) => db.referrers.push({ practiceId: 'pr1', type: 'DN', ...o })
  refr({ id: 'R1', name: 'Priya Natarajan, MD', npi: '1720394851', practiceName: 'Bay Orthopaedic Associates', phone: '718-555-0311', fax: '718-555-0312' })
  refr({ id: 'R2', name: 'Thomas Beckett, MD', npi: '1831405962', practiceName: 'Kings Joint Replacement Center', phone: '718-555-0322', fax: '718-555-0323' })
  refr({ id: 'R3', name: 'Hannah Morales, DO', npi: '1942516073', practiceName: 'Slope Family Medicine', phone: '718-555-0333', fax: '718-555-0334' })
  refr({ id: 'R4', name: 'Kwame Asante, MD', npi: '1053627184', practiceName: 'Harbor Hand & Upper Extremity', phone: '718-555-0344', fax: '718-555-0345' })
  refr({ id: 'R5', name: 'Leonard Voss, MD', npi: '9999999999', practiceName: 'Voss Pain Management', phone: '718-555-0355', fax: '' })
  refr({ id: 'R6', name: 'Rebecca Stone, MD', npi: '1164738295', practiceName: 'Harborline Medical Supervision', phone: '718-555-0366', fax: '', type: 'DQ' })
  refr({ id: 'R7', name: 'Samuel Ortiz, MD', npi: '1275849306', practiceName: 'North Shore Orthopedics', phone: '516-555-0377', fax: '', practiceId: 'pr2' })

  // ------------------------------------------------------------ patients, cases, coverage (§3.2, §10.4)
  let billingId = 10412
  let emrId = 56361600
  const pt = (o) => {
    const p = {
      practiceId: 'pr1', middleName: '', ssn: '', phoneHome: '', email: '', guarantor: null,
      notes: '', isActive: true, billingId: billingId++, emrId: emrId + Math.floor(Math.random() * 90 + 10), ...o,
    }
    emrId += 131
    db.patients.push(p)
    return p
  }
  // Seed-only hint: where this episode's visits usually happen and who bills them.
  // PRD V2 sets location and providers on each VISIT (CH-04); the case does not store them.
  const visitDefaults = {}
  const cs = (o) => {
    const { locationId, billingProviderId, ...rest } = o
    const c = { name: 'Default', injuryType: '', injuryDate: null, startOfCare: null, dischargeDate: null, accidentState: '', employmentStatus: '', isActive: true, ...rest }
    c.dx = (o.dx || []).map((code) => ({ code, desc: db.icd10.find((d) => d.code === code).desc }))
    visitDefaults[c.id] = { locationId, billingProviderId }
    db.cases.push(c)
    return c
  }
  const cov = (o) => db.coverages.push({ id: U.id('cv'), rank: 1, claimNumber: '', subscriber: null, employer: null, ...o })
  const auth = (o) => db.authorizations.push({ unit: 'Visits', ...o })
  const addr = (line1, city, state, zip) => ({ line1, line2: '', city, state, zip })

  pt({ id: 'p1', firstName: 'Nadia', lastName: 'Okonkwo', gender: 'Female', dob: '1984-06-12', address: addr('412 Ovington Avenue', 'Brooklyn', 'NY', '11209'), phoneCell: '718-555-0142', email: 'nadia.o@example.com', ssn: '412-55-7781' })
  cs({ id: 'c1', patientId: 'p1', name: 'R shoulder 2026', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R1', injuryDate: '2026-07-28', startOfCare: '2026-08-04', dx: ['M75.101', 'M25.511'] })
  cov({ caseId: 'c1', insuranceId: 'i3', memberId: 'W284019733', groupNumber: '0184421' })

  pt({ id: 'p2', firstName: 'Harold', lastName: 'Brennan', gender: 'Male', dob: '1951-02-03', address: addr('7520 Ridge Boulevard', 'Brooklyn', 'NY', '11209'), phoneCell: '718-555-0178', phoneHome: '718-555-0179', ssn: '208-44-1937', guarantor: null })
  cs({ id: 'c2', patientId: 'p2', name: 'L knee TKA rehab', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R2', injuryDate: '2026-06-30', startOfCare: '2026-07-07', dx: ['Z96.652', 'Z47.1', 'M62.81'] })
  cov({ caseId: 'c2', insuranceId: 'i1', memberId: '1EG4-TE5-MK72', groupNumber: 'NONE' })
  cov({ caseId: 'c2', insuranceId: 'i8', memberId: '38291744011', groupNumber: 'AARP-F', rank: 2 })

  pt({ id: 'p3', firstName: 'Maria', lastName: 'Gonzalez', gender: 'Female', dob: '1976-09-21', address: addr('331 5th Street', 'Brooklyn', 'NY', '11215'), phoneCell: '718-555-0156', email: 'mgonzalez@example.com' })
  cs({ id: 'c3', patientId: 'p3', name: 'Lumbar strain', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R3', injuryDate: '2026-06-22', startOfCare: '2026-07-14', dx: ['M54.50', 'M51.26'] })
  cov({ caseId: 'c3', insuranceId: 'i2', memberId: 'XEH849301266', groupNumber: '140233' })

  pt({ id: 'p4', firstName: 'James', lastName: 'Whitaker', gender: 'Male', dob: '1969-11-02', address: addr('88 Marine Avenue', 'Brooklyn', 'NY', '11209'), phoneCell: '718-555-0163' })
  cs({ id: 'c4', patientId: 'p4', name: 'Neck pain', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R1', startOfCare: '2026-08-18', dx: ['M54.2', 'S13.4XXD'] })
  cov({ caseId: 'c4', insuranceId: 'i4', memberId: '918273645', groupNumber: '705214' })

  pt({ id: 'p5', firstName: 'Linda', lastName: 'Park', gender: 'Female', dob: '1990-04-17', address: addr('59 Prospect Park West', 'Brooklyn', 'NY', '11215'), phoneCell: '718-555-0191' })
  cs({ id: 'c5', patientId: 'p5', name: 'Auto accident 08/2026', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R1', injuryType: 'Auto', injuryDate: '2026-08-09', accidentState: 'NY', startOfCare: '2026-08-20', dx: ['S13.4XXD', 'M54.2'] })
  cov({ caseId: 'c5', insuranceId: 'i6', memberId: 'GNF-7731902', groupNumber: 'NF-NY-01', claimNumber: '0547-88213-01' })

  pt({ id: 'p6', firstName: 'Robert', lastName: 'Chen', gender: 'Male', dob: '1958-12-30', address: addr('1402 Bay Ridge Parkway', 'Brooklyn', 'NY', '11228'), phoneCell: '718-555-0115' })
  cs({ id: 'c6', patientId: 'p6', name: 'R shoulder — work injury', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R4', injuryType: 'Employment Related', injuryDate: '2026-07-14', employmentStatus: 'Employed full time', startOfCare: '2026-07-16', dx: ['S46.011D', 'M25.511'] })
  cov({ caseId: 'c6', insuranceId: 'i5', memberId: 'WC-4417260', groupNumber: 'EMP-22019', claimNumber: '1439WC260300330', employer: { name: 'Atlas Freight LLC', address: '90 Hamilton Avenue, Brooklyn, NY 11231' } })

  pt({ id: 'p7', firstName: 'Aaliyah', lastName: 'Johnson', gender: 'Female', dob: '1995-03-08', address: addr('272 Senator Street', 'Brooklyn', 'NY', '11220'), phoneCell: '718-555-0127', email: 'aaliyah.j@example.com' })
  cs({ id: 'c7', patientId: 'p7', name: 'R ankle sprain', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R4', injuryDate: '2026-07-30', startOfCare: '2026-08-04', dx: ['S93.401D', 'M25.561'] })
  cov({ caseId: 'c7', insuranceId: 'i3', memberId: 'W771025846', groupNumber: '0190877' })

  pt({ id: 'p8', firstName: 'Samuel', lastName: 'Adeyemi', gender: 'Male', dob: '1988-07-25', address: addr('145 Garfield Place', 'Brooklyn', 'NY', '11215'), phoneCell: '718-555-0149' })
  cs({ id: 'c8', patientId: 'p8', name: 'ACL reconstruction', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R2', injuryDate: '2026-07-02', startOfCare: '2026-07-21', dx: ['S83.511D', 'M25.561'] })
  cov({ caseId: 'c8', insuranceId: 'i7', memberId: 'U58210334', groupNumber: '3340917' })

  pt({ id: 'p9', firstName: 'Eleanor', lastName: 'Fitzgerald', gender: 'Female', dob: '1945-05-19', address: addr('9201 Shore Road', 'Brooklyn', 'NY', '11209'), phoneHome: '718-555-0106', phoneCell: '' })
  cs({ id: 'c9', patientId: 'p9', name: 'Gait & balance', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R2', startOfCare: '2026-08-26', dx: ['R26.89', 'M62.81'] })
  cov({ caseId: 'c9', insuranceId: 'i1', memberId: '3HT7-QW2-PL19', groupNumber: 'NONE' })

  pt({ id: 'p10', firstName: 'Victor', lastName: 'Moreau', gender: 'Male', dob: '1972-08-14', address: addr('610 3rd Street', 'Brooklyn', 'NY', '11215'), phoneCell: '000-000-0000' })
  cs({ id: 'c10', patientId: 'p10', name: 'Plantar fasciitis', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R3', startOfCare: '2026-09-14', dx: ['M72.2'] })
  cov({ caseId: 'c10', insuranceId: 'i3', memberId: 'W390112784', groupNumber: '0184421' })

  pt({ id: 'p11', firstName: 'Grace', lastName: 'Holloway', gender: 'Female', dob: '1981-01-29', address: addr('44 Hudson Place', 'Brooklyn', 'NY', '07030'), phoneCell: '718-555-0133' })
  cs({ id: 'c11', patientId: 'p11', name: 'L shoulder impingement', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R1', startOfCare: '2026-09-14', dx: ['M25.512'] })
  cov({ caseId: 'c11', insuranceId: 'i2', memberId: 'XEH551209873', groupNumber: '140233' })

  pt({ id: 'p12', firstName: 'Dmitri', lastName: 'Volkov', gender: 'Male', dob: '1966-10-05', address: addr('7811 4th Avenue', 'Brooklyn', 'NY', '11209'), phoneCell: '718-555-0184' })
  cs({ id: 'c12', patientId: 'p12', name: 'Chronic low back', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R5', startOfCare: '2026-09-14', dx: ['M54.50', 'G89.29'] })
  cov({ caseId: 'c12', insuranceId: 'i3', memberId: 'W118870451', groupNumber: '0177230' })

  pt({ id: 'p13', firstName: 'Priya', lastName: 'Shah', gender: 'Female', dob: '1993-12-11', address: addr('190 Berkeley Place', 'Brooklyn', 'NY', '11217'), phoneCell: '718-555-0172', email: 'priya.shah@example.com' })
  cs({ id: 'c13', patientId: 'p13', name: 'Achilles tendinitis', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R3', startOfCare: '2026-09-03', dx: ['M76.61'] })
  cov({ caseId: 'c13', insuranceId: 'i4', memberId: '927710438', groupNumber: '705214' })

  pt({ id: 'p14', firstName: 'Thomas', lastName: 'Reilly', gender: 'Male', dob: '1979-06-02', address: addr('8410 Colonial Road', 'Brooklyn', 'NY', '11209'), phoneCell: '718-555-0120' })
  cs({ id: 'c14', patientId: 'p14', name: 'R knee OA', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R2', startOfCare: '2026-09-14', dx: ['M17.11'] })
  cov({ caseId: 'c14', insuranceId: 'i3', memberId: 'W660291357', groupNumber: '0190877' })

  pt({ id: 'p15', firstName: 'Hannah', lastName: 'Levi', gender: 'Female', dob: '1987-02-14', address: addr('77 Union Street', 'Brooklyn', 'NY', '11231'), phoneCell: '718-555-0168' })
  cs({ id: 'c15', patientId: 'p15', name: 'Cervical strain', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R3', startOfCare: '2026-09-14', dx: ['S13.4XXD'] })
  cov({ caseId: 'c15', insuranceId: 'i3', memberId: 'W902273310', groupNumber: '0184421' })

  pt({ id: 'p16', firstName: 'Oliver', lastName: 'Grant', gender: 'Male', dob: '1999-09-09', address: addr('301 Court Street', 'Brooklyn', 'NY', '11231'), phoneCell: '718-555-0139' })
  cs({ id: 'c16', patientId: 'p16', name: 'Default', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R1', startOfCare: '2026-09-14', dx: ['S93.401D'] })
  cov({ caseId: 'c16', insuranceId: 'i9', memberId: 'OSC-44210987', groupNumber: 'OSC-NYC' })

  pt({ id: 'p17', firstName: 'Beatrice', lastName: 'Nwosu', gender: 'Female', dob: '1954-04-30', address: addr('6801 Colonial Road', 'Brooklyn', 'NY', '11220'), phoneCell: '718-555-0151', phoneHome: '718-555-0152' })
  cs({ id: 'c17', patientId: 'p17', name: 'R knee OA', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R2', startOfCare: '2026-08-18', dx: ['M17.11', 'M25.561'] })
  cov({ caseId: 'c17', insuranceId: 'i1', memberId: '7KD2-NM4-HT55', groupNumber: 'NONE' })

  pt({ id: 'p18', firstName: 'Kevin', lastName: "O'Brien", gender: 'Male', dob: '1974-03-19', address: addr('155 Bay Ridge Avenue', 'Brooklyn', 'NY', '11220'), phoneCell: '718-555-0188' })
  cs({ id: 'c18', patientId: 'p18', name: 'Lumbar disc', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R3', startOfCare: '2026-08-03', dx: ['M51.26', 'M54.50'] })
  cov({ caseId: 'c18', insuranceId: 'i2', memberId: 'XEH338120945', groupNumber: '' })

  pt({ id: 'p19', firstName: 'Sophia', lastName: 'Russo', gender: 'Female', dob: '1983-08-08', address: addr('1850 Shore Parkway', 'Brooklyn', 'NY', '11214'), phoneCell: '718-555-0194' })
  cs({ id: 'c19', patientId: 'p19', name: 'R foot fracture', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R1', injuryDate: '2026-07-19', startOfCare: '2026-08-12', dx: ['S92.352D'] })
  cov({ caseId: 'c19', insuranceId: 'i3', memberId: 'W507739214', groupNumber: '0184421' })

  pt({ id: 'p20', firstName: 'Daniel', lastName: 'Kim', gender: 'Male', dob: '1991-05-27', address: addr('422 Sackett Street', 'Brooklyn', 'NY', '11231'), phoneCell: '718-555-0112' })
  cs({ id: 'c20', patientId: 'p20', name: 'L ankle sprain', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R3', startOfCare: '2026-08-18', dx: ['S93.401D'] })
  cov({ caseId: 'c20', insuranceId: 'i4', memberId: '918200044', groupNumber: '705214' })

  pt({ id: 'p21', firstName: 'Rachel', lastName: 'Adler', gender: 'Female', dob: '1970-10-10', address: addr('503 Carroll Street', 'Brooklyn', 'NY', '11215'), phoneCell: '718-555-0145' })
  cs({ id: 'c21', patientId: 'p21', name: 'R shoulder impingement', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R1', startOfCare: '2026-08-25', dx: ['M75.41'] })
  cov({ caseId: 'c21', insuranceId: 'i7', memberId: 'U58219921', groupNumber: '3340917' })

  pt({ id: 'p22', firstName: 'Ethan', lastName: 'Brooks', gender: 'Male', dob: '1985-01-05', address: addr('9014 Ridge Boulevard', 'Brooklyn', 'NY', '11209'), phoneCell: '718-555-0176' })
  cs({ id: 'c22', patientId: 'p22', name: 'L knee meniscus', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R2', startOfCare: '2026-06-23', dx: ['M25.562'] })
  cov({ caseId: 'c22', insuranceId: 'i3', memberId: 'W223094471', groupNumber: '0177230' })

  pt({ id: 'p23', firstName: 'Lucia', lastName: 'Fernandez', gender: 'Female', dob: '1978-03-03', address: addr('38 7th Avenue', 'Brooklyn', 'NY', '11217'), phoneCell: '718-555-0158' })
  cs({ id: 'c23', patientId: 'p23', name: 'R knee pain', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R3', startOfCare: '2026-08-04', dx: ['M25.561'] })
  cov({ caseId: 'c23', insuranceId: 'i2', memberId: 'XEH770045128', groupNumber: '140233' })

  pt({ id: 'p24', firstName: 'George', lastName: 'Whitman', gender: 'Male', dob: '1949-07-07', address: addr('9920 4th Avenue', 'Brooklyn', 'NY', '11209'), phoneHome: '718-555-0103', phoneCell: '' })
  cs({ id: 'c24', patientId: 'p24', name: 'Deconditioning', locationId: 'L1', billingProviderId: 'P1', referrerId: 'R2', startOfCare: '2026-07-21', dx: ['M62.81', 'R26.2'] })
  cov({ caseId: 'c24', insuranceId: 'i1', memberId: '5QP1-WE8-RT21', groupNumber: 'NONE' })

  pt({ id: 'p25', firstName: 'Maximilian Alexander', lastName: 'Castellanos-Whitmore', gender: 'Male', dob: '1968-11-21', address: addr('240 Prospect Park Southwest', 'Brooklyn', 'NY', '11218'), phoneCell: '718-555-0197' })
  cs({ id: 'c25', patientId: 'p25', name: 'R hip', locationId: 'L2', billingProviderId: 'P1', referrerId: 'R1', startOfCare: '2026-09-14', dx: ['M62.81'] })
  cov({ caseId: 'c25', insuranceId: 'i3', memberId: 'W118829930', groupNumber: '0190877' })

  pt({ id: 'p26', firstName: 'Walter', lastName: 'Nguyen', gender: 'Male', dob: '1963-02-18', address: addr('502 83rd Street', 'Brooklyn', 'NY', '11209'), phoneCell: '718-555-0122' })
  cs({ id: 'c26', patientId: 'p26', name: 'R hand therapy', locationId: 'L2', billingProviderId: 'P5', referrerId: 'R4', startOfCare: '2026-08-07', dx: ['M79.641'] })
  cov({ caseId: 'c26', insuranceId: 'i3', memberId: 'W330981276', groupNumber: '0177230' })

  // Northgate Sports & Spine
  pt({ id: 'p30', practiceId: 'pr2', firstName: 'Isabella', lastName: 'Marino', gender: 'Female', dob: '1950-08-02', address: addr('12 Station Plaza', 'Great Neck', 'NY', '11021'), phoneCell: '516-555-0141' })
  cs({ id: 'c30', patientId: 'p30', name: 'L hip OA', locationId: 'L4', billingProviderId: 'P7', referrerId: 'R7', startOfCare: '2026-08-05', dx: ['M62.81', 'R26.2'] })
  cov({ caseId: 'c30', insuranceId: 'i10', memberId: '2WE8-TY4-KL90', groupNumber: 'NONE' })
  pt({ id: 'p31', practiceId: 'pr2', firstName: 'Frank', lastName: 'Delgado', gender: 'Male', dob: '1977-12-14', address: addr('88 Middle Neck Road', 'Great Neck', 'NY', '11021'), phoneCell: '516-555-0156' })
  cs({ id: 'c31', patientId: 'p31', name: 'Lumbar strain', locationId: 'L4', billingProviderId: 'P7', referrerId: 'R7', startOfCare: '2026-08-06', dx: ['M54.50'] })
  cov({ caseId: 'c31', insuranceId: 'i11', memberId: 'W881203347', groupNumber: '0210044' })
  pt({ id: 'p32', practiceId: 'pr2', firstName: 'Zoe', lastName: 'Carter', gender: 'Female', dob: '2001-06-30', address: addr('7 Cuttermill Road', 'Great Neck', 'NY', '11021'), phoneCell: '516-555-0163' })
  cs({ id: 'c32', patientId: 'p32', name: 'R ankle', locationId: 'L4', billingProviderId: 'P8', referrerId: 'R7', startOfCare: '2026-09-08', dx: ['S93.401D'] })
  cov({ caseId: 'c32', insuranceId: 'i11', memberId: 'W881244190', groupNumber: '0210044' })

  // Authorizations
  auth({ id: 'a1', coverageId: db.coverages.find((c) => c.caseId === 'c3').id, number: '0VJL671TT', start: '2026-07-10', end: '2026-09-07', qty: 6, used: 0 })
  auth({ id: 'a2', coverageId: db.coverages.find((c) => c.caseId === 'c4').id, number: 'UHC-2026-55120', start: '2026-08-01', end: '2026-10-31', qty: 12, used: 5 })
  auth({ id: 'a3', coverageId: db.coverages.find((c) => c.caseId === 'c11').id, number: 'BC-2026-88412', start: '2026-08-15', end: '2026-11-15', qty: 12, used: 3 })
  auth({ id: 'a4', coverageId: db.coverages.find((c) => c.caseId === 'c13').id, number: 'UHC-2026-60177', start: '2026-09-01', end: '2026-12-01', qty: 10, used: 0 })
  auth({ id: 'a5', coverageId: db.coverages.find((c) => c.caseId === 'c18').id, number: 'BC-2026-90155', start: '2026-08-01', end: '2026-10-31', qty: 20, used: 0 })
  auth({ id: 'a6', coverageId: db.coverages.find((c) => c.caseId === 'c6').id, number: 'WC-AUTH-33871', start: '2026-07-15', end: '2026-10-15', qty: 24, used: 0 })
  auth({ id: 'a7', coverageId: db.coverages.find((c) => c.caseId === 'c20').id, number: 'UHC-2026-77120', start: '2026-08-15', end: '2026-09-05', qty: 4, used: 0 })
  auth({ id: 'a8', coverageId: db.coverages.find((c) => c.caseId === 'c23').id, number: 'BC-2026-81230', start: '2026-08-18', end: '2026-11-18', qty: 12, used: 2 })

  // ------------------------------------------------------------ visits, claims, payments
  let rec = 5590100
  const mkVisit = (caseId, dos, provId, lines, status, o = {}) => {
    const c = db.cases.find((x) => x.id === caseId)
    const p = db.providers.find((x) => x.id === provId)
    const loc = o.loc || visitDefaults[caseId].locationId
    const v = {
      id: U.id('v'), caseId, dos, locationId: loc, billingProviderId: o.billingProviderId || visitDefaults[caseId].billingProviderId, treatingProviderId: provId,
      authorizationId: null, dx: c.dx.map((x) => x.code), status, pendReason: o.pendReason || '', manualPend: !!o.manualPend,
      source: o.source || 'EMR', recordId: o.recordId || `EMR-N-${rec++}`,
      createdOn: o.createdOn || dos, releasedOn: o.releasedOn || null, wi: S.workItem(o.wi || {}),
    }
    const linePos = o.pos || db.locations.find((l) => l.id === loc).pos
    db.visits.push(v)
    const specMod = p && p.specialty === 'OCCUPATIONAL THERAPIST' ? 'GO' : null
    lines.forEach(([code, units, ptrs, mods]) => {
      const pcx = db.procedureCodes.find((x) => x.code === code)
      const line = {
        id: U.id('ln'), visitId: v.id, procedureCodeId: pcx.id, units,
        modifiers: mods || (specMod ? [specMod] : pcx.defaultModifier ? [pcx.defaultModifier] : []),
        pointers: ptrs || (v.dx.length > 1 ? [1, 2] : [1]), pos: linePos, notes: '', amount: 0, balIns: 0, balPat: 0,
      }
      db.chargeLines.push(line)
      E.priceLine(line, v)
    })
    return v
  }
  const passScrub = (sent) => ({
    at: at(sent, '18:00'), applied: [],
    results: [
      { key: 'rules', name: 'Coding rules engine', status: 'pass', detail: 'No Replace or Drop rule matched this claim.', source: 'Default & payer-specific rules' },
      ...E.HOLD_ORDER.map((k) => ({ key: k, name: E.HOLDS[k].check, source: E.HOLDS[k].source, status: k === 'manual' ? 'skip' : 'pass', detail: k === 'manual' ? 'Insurance hold not checked — automatic submission.' : 'Passed.' })),
    ],
  })
  let refN = 0
  const mkSent = (v, rank, sent, o = {}) => {
    const covx = E.coverage(v.caseId, rank)
    const ins = E.insOf(covx)
    const claim = E.newClaim(v, covx, { createdOn: sent })
    claim.status = 'Submitted'
    claim.sentDate = sent
    claim.format = ins.format
    refN += 1
    claim.clearinghouseRef = `WS${sent.replace(/-/g, '')}-${String(refN % 90 + 10).padStart(3, '0')}`
    claim.payerIcn = `26${String(100000000 + refN * 7919).slice(0, 9)}`
    claim.slaDue = U.addDays(sent, ins.slaDays)
    claim.accepted = true
    claim.scrub = passScrub(sent)
    if (E.eff(ins, 'insuranceHold')) {
      claim.bucketId = ins.releaseBucketId
      claim.released = { by: 'u3', at: at(sent, '10:30'), bucketId: ins.releaseBucketId }
    }
    E.claimLines(claim).forEach((l) => (l.billed = true))
    claim.snapshot = E.snapshot(claim)
    if (rank === 1 && E.eff(ins, 'authRequired')) {
      const a = db.authorizations.find((x) => x.coverageId === covx.id && x.start <= v.dos && x.end >= v.dos)
      if (a) {
        a.used += 1
        claim.authId = a.id
        v.authorizationId = a.id
      }
    }
    v.status = 'Billed'
    v.releasedOn = v.releasedOn || sent
    Object.assign(claim, o)
    A(v.createdOn, '17:40', 'u8', 'Session received from EMR', 'CHARGES', 'visit', v.id, `Record ${v.recordId}`, S.patientOfVisit(v).practiceId)
    A(sent, '10:05', 'u3', 'Visit released for claiming', 'CHARGES', 'visit', v.id, '', S.patientOfVisit(v).practiceId)
    A(sent, '18:01', 'u8', `Claim submitted to Waystar (${claim.format === 'CMS1500' ? 'CMS-1500 print queue' : 'EDI 837P'})`, 'BILLING', 'claim', claim.id, `${ins.name} · ${U.money(claim.total)} · ref ${claim.clearinghouseRef}`, S.patientOfVisit(v).practiceId)
    return claim
  }
  const batchFor = {}
  const eraFor = {}
  const payHist = (claim, payDate, opts = {}) => {
    const covx = db.coverages.find((c) => c.id === claim.coverageId)
    const ins = E.insOf(covx)
    const key = `${ins.id}|${payDate}`
    const manual = ins.format === 'CMS1500'
    if (!batchFor[key]) {
      const checkNumber = manual ? `CHK-${String(4400 + Object.keys(batchFor).length * 7)}` : `${ins.payerId}-835-${payDate.replace(/-/g, '').slice(2)}`
      batchFor[key] = { id: U.id('bt'), practiceId: ins.practiceId, source: manual ? 'Manual' : 'ERA', insuranceId: ins.id, checkNumber, checkDate: U.addDays(payDate, -1), checkAmount: 0, status: 'Posted', postedOn: payDate, postedBy: manual ? 'u3' : 'u8', entries: [] }
      db.batches.push(batchFor[key])
      if (!manual) {
        eraFor[key] = { id: U.id('era'), practiceId: ins.practiceId, insuranceId: ins.id, control: checkNumber, received: at(payDate, '06:30'), status: 'Posted', claims: [] }
        db.eras.push(eraFor[key])
        batchFor[key].eraId = eraFor[key].id
      }
    }
    const batch = batchFor[key]
    const ec = E.adjudicate(claim, opts.outcome || 'paid', opts.carc, opts.rarc)
    ec.status = 'posted'
    if (eraFor[key]) eraFor[key].claims.push(ec)
    let paid = 0
    ec.lines.forEach((el) => {
      const line = db.chargeLines.find((l) => l.id === el.lineId)
      if (el.denied) return
      if (el.paid > 0) db.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: ins.id, kind: 'Insurance payment', amount: el.paid, pr: el.pr, prCode: el.prCode, allowed: el.allowed, reasonCode: '', checkNumber: batch.checkNumber, checkDate: batch.checkDate, postedDate: payDate, batchId: batch.id })
      if (el.contractual > 0) db.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: ins.id, kind: 'Adjustment', amount: el.contractual, reasonCode: 'CO-45', checkNumber: batch.checkNumber, checkDate: batch.checkDate, postedDate: payDate, batchId: batch.id })
      paid += el.paid
      const remaining = U.round(line.balIns - el.paid - el.contractual)
      const next = E.coverage(S.visitOf(claim).caseId, claim.rank + 1)
      if (next && remaining > 0) line.balIns = remaining
      else {
        line.balIns = 0
        line.balPat = U.round(line.balPat + Math.max(0, remaining))
      }
    })
    batch.checkAmount = U.round(batch.checkAmount + paid)
    const pid = S.patientOfVisit(S.visitOf(claim)).practiceId
    if (opts.outcome === 'denied') {
      claim.status = 'Denied'
      claim.ar = 'Denied'
      A(payDate, '07:10', 'u8', 'Claim denied — cloned into Denial & A/R', 'BILLING', 'claim', claim.id, `${opts.carc} ${E.carcDesc(opts.carc)}`, pid)
    } else {
      claim.status = 'Paid'
      claim.paidDate = payDate
      A(payDate, manual ? '11:20' : '07:10', manual ? 'u3' : 'u8', 'Payment posted', 'PAYMENTS', 'claim', claim.id, `${ins.name} paid ${U.money(paid)} · batch ${batch.checkNumber}`, pid)
    }
    return ec
  }
  const lag = { i1: 14, i2: 24, i3: 21, i4: 22, i5: 30, i6: 35, i7: 20, i8: 10, i10: 14, i11: 21 }
  const PAY_CUTOFF = '2026-09-12'
  /** Weekly history for a case: claims sent the day after DOS, paid after the
   *  payer's typical lag if that falls before the cutoff. */
  const history = (caseId, provId, dates, lines, o = {}) => {
    const out = []
    dates.forEach((dos) => {
      const v = mkVisit(caseId, dos, provId, lines, 'Billed')
      const sent = U.addDays(dos, 1)
      const claim = mkSent(v, 1, sent)
      const ins = E.insOf(E.coverage(caseId, 1))
      const payDate = U.addDays(sent, lag[ins.id])
      if (!o.unpaid?.includes(dos) && payDate <= PAY_CUTOFF) {
        payHist(claim, payDate)
        const sec = E.coverage(caseId, 2)
        if (sec && E.claimInsBalance(claim) > 0) {
          const secSent = U.addDays(payDate, 1)
          const sc = mkSent(v, 2, secSent, { box29: E.claimPaid(claim), primaryClaimId: claim.id })
          sc.lineIds = [...claim.lineIds]
          sc.total = E.claimTotal(sc)
          const secPay = U.addDays(secSent, lag[sec.insuranceId])
          if (secPay <= PAY_CUTOFF) payHist(sc, secPay)
        }
      }
      out.push({ v, claim })
    })
    return out
  }
  const L3 = [['97110', 2], ['97140', 1], ['97530', 1]]

  // Harborline history
  const h1 = history('c1', 'P1', ['2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25', '2026-09-01'], L3)
  const h2 = history('c2', 'P1', ['2026-07-07', '2026-07-14', '2026-07-21', '2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25', '2026-09-01', '2026-09-08'], [['97110', 2], ['97116', 1], ['97530', 1]])
  history('c3', 'P3', ['2026-07-14', '2026-07-21', '2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18'], [['97110', 2], ['97140', 1], ['97530', 1]])
  history('c6', 'P3', ['2026-07-16', '2026-07-23', '2026-07-30', '2026-08-06', '2026-08-13', '2026-08-27'], [['97110', 3], ['97140', 2], ['97530', 2]])
  const h7 = history('c7', 'P1', ['2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25'], [['97110', 2], ['97112', 1], ['97140', 1]])
  const h17 = history('c17', 'P1', ['2026-08-18', '2026-08-25', '2026-09-01', '2026-09-08'], [['97110', 2], ['97140', 1], ['97530', 1]])
  history('c18', 'P2', ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'], [['97110', 2], ['97112', 1], ['97140', 1]])
  const h22 = history('c22', 'P1', ['2026-07-07', '2026-07-14', '2026-08-04', '2026-08-11', '2026-09-08'], [['97110', 2], ['97140', 1], ['97530', 1]], { unpaid: ['2026-08-04', '2026-08-11'] })
  history('c26', 'P5', ['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'], [['97530', 2], ['97535', 1]])
  history('c8', 'P1', ['2026-07-21', '2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18', '2026-08-25', '2026-09-01'], [['97110', 2], ['97112', 1], ['97530', 1]])
  history('c24', 'P1', ['2026-07-21', '2026-08-04', '2026-08-18'], [['97110', 2], ['97116', 1], ['97530', 1]])
  history('c20', 'P2', ['2026-08-18', '2026-08-25'], [['97110', 2], ['97140', 1]])
  history('c21', 'P1', ['2026-08-25'], [['97110', 2], ['97140', 1]])
  history('c23', 'P3', ['2026-08-04'], [['97110', 2], ['97140', 1]])
  history('c19', 'P1', ['2026-08-12', '2026-08-19', '2026-08-26'], [['97110', 2], ['97530', 1]])
  // Northgate history
  history('c30', 'P7', ['2026-08-05', '2026-08-12', '2026-08-19', '2026-09-02'], [['97110', 2], ['97116', 1], ['97530', 1]])
  history('c31', 'P8', ['2026-08-06', '2026-08-13', '2026-08-20'], [['97110', 2], ['97140', 1]])

  // A/R: Ethan's 08/04 claim already escalated as Delayed by the SLA engine on 09/05
  const delayedClaim = h22.find((x) => x.v.dos === '2026-08-04').claim
  delayedClaim.ar = 'Delayed'
  delayedClaim.arSince = '2026-09-05'
  delayedClaim.wi = S.workItem({ owner: 'u6', priority: 'High', due: '2026-09-16', next: 'Call Aetna provider services for claim status' })
  A('2026-09-05', '02:00', 'u8', 'Payer SLA exceeded — cloned into Denial & A/R (Delayed)', 'AR', 'claim', delayedClaim.id, 'SLA due 09/04/2026, no payment acknowledgement')
  A('2026-09-09', '14:22', 'u6', 'Follow-up logged', 'AR', 'claim', delayedClaim.id, 'Called Aetna — claim in process, rep asked to call back after 09/15.')

  // ---- Denials (§10.5 denial)
  const denyClaim = (caseId, dos, provId, lines, carc, rarc, recv, status, wi, extra = {}) => {
    const v = mkVisit(caseId, dos, provId, lines, 'Billed')
    const claim = mkSent(v, 1, U.addDays(dos, 1))
    payHist(claim, recv, { outcome: 'denied', carc, rarc })
    E.claimLines(claim).forEach((line) => {
      const den = { id: U.id('dn'), chargeLineId: line.id, claimId: claim.id, carc, rarc, receivedDate: recv, status, notes: extra.notes || '', practiceId: 'pr1', wi: S.workItem(wi), appealedOn: extra.appealedOn || null }
      db.denials.push(den)
      A(recv, '07:12', 'u8', 'Denial received via ERA (835)', 'DENIALS', 'denial', den.id, `${E.pc(line.procedureCodeId).code} · ${carc} ${E.carcDesc(carc)}`)
      if (extra.appealedOn) A(extra.appealedOn, '15:40', 'u3', 'Appeal submitted', 'DENIALS', 'denial', den.id, extra.notes || '')
      if (status === 'Written off') {
        db.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: null, kind: 'Adjustment', amount: line.balIns, reasonCode: 'CO-29', checkNumber: 'WRITE-OFF', checkDate: '2026-08-20', postedDate: '2026-08-20', batchId: null })
        line.balIns = 0
        A('2026-08-20', '12:05', 'u3', 'Denial written off', 'DENIALS', 'denial', den.id, 'Timely filing — no proof of submission found')
      }
      if (status === 'Resolved') {
        // Line balances are computed from posted rows in PRD V2 (CH-09), so closing a duplicate posts its adjustment.
        db.payments.push({ id: U.id('pm'), chargeLineId: line.id, claimId: claim.id, insuranceId: null, kind: 'Adjustment', amount: line.balIns, reasonCode: 'CO-18', checkNumber: 'DUPLICATE', checkDate: '2026-08-24', postedDate: '2026-08-24', batchId: null })
        line.balIns = 0
        A('2026-08-24', '10:30', 'u6', 'Denial resolved', 'DENIALS', 'denial', den.id, 'Duplicate of a paid claim — closed')
      }
    })
    return claim
  }
  denyClaim('c23', '2026-08-11', 'P3', [['97110', 2], ['97140', 1]], 'CO-197', 'N54', '2026-09-02', 'Open', { owner: 'u3', priority: 'High', due: '2026-09-19', next: 'Request a retro-authorization from Empire BCBS' })
  denyClaim('c24', '2026-07-28', 'P1', [['97750', 1]], 'CO-50', 'M127', '2026-08-12', 'Appealed', { owner: 'u3', priority: 'Medium', due: '2026-09-28', next: 'Await redetermination decision' }, { appealedOn: '2026-08-29', notes: 'Redetermination sent with the functional test report and plan of care.' })
  denyClaim('c7', '2026-08-28', 'P1', [['97110', 2], ['97112', 1]], 'CO-16', 'MA130', '2026-09-10', 'Open', { owner: 'u6', priority: 'Medium', due: '2026-09-17', next: 'Correct the missing information and resend' })
  denyClaim('c1', '2026-07-28', 'P1', [['97110', 2]], 'CO-18', '', '2026-08-19', 'Resolved', { owner: 'u6', priority: 'Low', next: '' }, { notes: 'Duplicate of a paid claim.' })
  denyClaim('c22', '2026-06-23', 'P1', [['97162', 1]], 'CO-29', '', '2026-08-12', 'Written off', { owner: 'u3', priority: 'Low', next: '' }, { notes: 'Timely filing limit passed.' })

  // ---- Rejections (Rejections & Reasons, §7.2)
  const rj = (caseId, dos, provId, lines, code, reason) => {
    const v = mkVisit(caseId, dos, provId, lines, 'Billed')
    const claim = mkSent(v, 1, U.addDays(dos, 1))
    claim.status = 'Rejected'
    claim.accepted = false
    claim.rejection = { code, reason, date: U.addDays(dos, 2) }
    claim.wi = S.workItem({ owner: 'u3', priority: 'High', due: U.addDays(DB.today, 1), next: 'Correct the rejected data and resubmit' })
    A(U.addDays(dos, 2), '05:15', 'u8', 'Rejected by clearinghouse', 'BILLING', 'claim', claim.id, `${code} ${reason}`)
    return claim
  }
  rj('c20', '2026-09-02', 'P2', [['97110', 2], ['97140', 1]], 'A7:33', 'Subscriber and subscriber ID not found')
  rj('c21', '2026-09-01', 'P1', [['97110', 2], ['97140', 1]], 'A7:164', 'Entity’s contract/member number is invalid')

  // ---- Scenario: holds (claims that failed scrubbing, §6.2)
  const held = (caseId, dos, provId, lines, created) => {
    const v = mkVisit(caseId, dos, provId, lines, 'Billed', { createdOn: dos, releasedOn: created })
    const claim = E.newClaim(v, E.coverage(caseId, 1), { createdOn: created })
    E.scrub(claim, {})
    claim.heldSince = created
    claim.scrub.at = at(created, '18:00')
    claim.wi.owner = 'u3'
    A(dos, '17:35', 'u8', 'Session received from EMR', 'CHARGES', 'visit', v.id, `Record ${v.recordId}`)
    A(created, '10:12', 'u3', 'Visit released for claiming', 'CHARGES', 'visit', v.id)
    A(created, '18:00', 'u8', `Claim held — ${E.HOLDS[claim.holdReason].label}`, 'BILLING', 'claim', claim.id, claim.scrub.results.find((r) => r.key === claim.holdReason).detail)
    return claim
  }
  const hA = held('c3', '2026-09-08', 'P3', [['97110', 2], ['97140', 1], ['97530', 1]], '2026-09-09')
  const hM = held('c18', '2026-09-09', 'P2', [['97110', 2], ['97112', 1]], '2026-09-10')
  const hC = held('c9', '2026-09-10', 'P1', [['97750', 1, [1]], ['97110', 2, [1, 2]]], '2026-09-11')
  const hP = held('c6', '2026-09-10', 'P3', [['97110', 7], ['97140', 2]], '2026-09-11')
  // a1 is exhausted by the six history visits; the 09/08 claim is therefore on Authorization Hold
  // GEICO has the insurance hold checked: this claim passed every check and waits in its release bucket
  const hR = held('c5', '2026-09-10', 'P3', [['97110', 2], ['97140', 1], ['97530', 1]], '2026-09-11')
  void hR
  void hA
  void hM
  void hC
  void hP

  // ---- Scenario: ready to submit (Released = ingestion queue, §5.1)
  const released = (caseId, dos, provId, lines, o = {}) => {
    const v = mkVisit(caseId, dos, provId, lines, 'Released', { releasedOn: '2026-09-15', ...o })
    A(dos, '17:50', 'u8', 'Session received from EMR', 'CHARGES', 'visit', v.id, `Record ${v.recordId}`)
    A('2026-09-15', '08:41', 'u3', 'Visit released for claiming', 'CHARGES', 'visit', v.id)
    return v
  }
  released('c2', '2026-09-14', 'P1', [['97110', 2], ['97014', 1], ['97010', 1]])
  released('c4', '2026-09-14', 'P2', [['97110', 2], ['97140', 1]])
  released('c5', '2026-09-14', 'P3', [['97110', 2], ['97140', 1], ['97530', 1]])
  released('c8', '2026-09-14', 'P1', [['97110', 2], ['97112', 1], ['97530', 1]])
  released('c1', '2026-09-11', 'P1', [['97110', 2], ['97140', 1], ['97530', 1]])

  // ---- Scenario: charge review (Review, §10.5)
  const review = (caseId, dos, provId, lines, hm, source = 'EMR') => {
    const v = mkVisit(caseId, dos, provId, lines, 'Review', { source, createdOn: dos })
    A(dos, hm, source === 'EMR' ? 'u8' : 'u3', source === 'EMR' ? 'Session received from EMR' : 'Charge entered manually', 'CHARGES', 'visit', v.id, `Record ${v.recordId}`)
    return v
  }
  review('c7', '2026-09-15', 'P1', [['97110', 2], ['97112', 1], ['97140', 1]], '08:05')
  review('c17', '2026-09-15', 'P1', [['97110', 2], ['97140', 1], ['97530', 1]], '08:12')
  review('c22', '2026-09-14', 'P1', [['97110', 2], ['97140', 1]], '18:20')
  review('c18', '2026-09-15', 'P2', [['97110', 2], ['97112', 1], ['97140', 1]], '08:30')
  review('c9', '2026-09-15', 'P1', [['97116', 2], ['97110', 1]], '09:02', 'Manual')
  review('c26', '2026-09-11', 'P5', [['97530', 2], ['97535', 1]], '17:10')
  review('c32', '2026-09-15', 'P8', [['97161', 1], ['97110', 1]], '08:44')
  review('c31', '2026-09-14', 'P8', [['97110', 2], ['97140', 1]], '17:30')

  // ---- Scenario: intake outcomes decided by the engine (§4.3, §4.4, §10.5)
  const arrive = (caseId, dos, provId, lines, hm) => {
    const v = mkVisit(caseId, dos, provId, lines, 'Review', { createdOn: dos })
    E.intake(v)
    A(dos, hm, 'u8', 'Session received from EMR', 'CHARGES', 'visit', v.id, `Record ${v.recordId} → ${v.status}`)
    return v
  }
  arrive('c3', '2026-09-11', 'P3', [['97110', 2], ['97140', 1]], '17:20') // Pended: no authorization
  arrive('c3', '2026-09-15', 'P3', [['97110', 2], ['97140', 1], ['97530', 1]], '08:20') // Pended
  arrive('c20', '2026-09-12', 'P2', [['97110', 2], ['97140', 1]], '12:40') // Pended: auth expired
  arrive('c13', '2026-09-10', 'P4', [['97110', 2], ['97140', 1]], '17:05') // Delayed: provider hold
  arrive('c13', '2026-09-14', 'P4', [['97110', 2], ['97112', 1]], '17:15') // Delayed
  arrive('c10', '2026-09-14', 'P1', [['97162', 1], ['97110', 1]], '16:30') // Patient: dummy phone
  arrive('c11', '2026-09-14', 'P1', [['97161', 1], ['97110', 1]], '16:45') // Patient: ZIP/state
  arrive('c12', '2026-09-14', 'P1', [['97162', 1], ['97140', 1]], '17:00') // Case: dummy referring NPI
  arrive('c14', '2026-09-14', 'P1', [['97110', 2], ['97033', 1]], '17:25') // Charge: $0.00 new CPT
  arrive('c21', '2026-09-14', 'P9', [['97110', 2], ['97140', 1]], '17:45') // Session: missing rendering NPI
  arrive('c25', '2026-09-14', 'P1', [['97162', 1]], '15:55') // Patient: character limit
  arrive('c15', '2026-09-14', 'P6', [['97110', 2], ['97140', 1]], '16:10') // Incomplete: draft provider
  arrive('c16', '2026-09-14', 'P1', [['97161', 1], ['97110', 1]], '16:20') // Incomplete: draft insurance
  db.exceptions.forEach((x) => {
    const v = db.visits.find((vv) => vv.id === x.visitId)
    x.detectedAt = at(v.dos, '17:30')
    x.wi.owner = x.level === 'Charge' ? 'u3' : null
  })

  // ---- Scenario: re-sent note replaced a record still in review → Inactive Records (§4.2)
  const orig = mkVisit('c7', '2026-09-08', 'P1', [['97110', 1], ['97140', 1]], 'Inactive', { recordId: 'EMR-N-5590911' })
  const repl = mkVisit('c7', '2026-09-08', 'P1', [['97110', 2], ['97112', 1], ['97140', 1]], 'Billed', { recordId: 'EMR-N-5590911' })
  orig.supersededBy = repl.id
  orig.inactiveReason = 'Superseded by a re-sent EMR note'
  orig.inactiveOn = '2026-09-08'
  repl.replaces = orig.id
  mkSent(repl, 1, '2026-09-09')
  A('2026-09-08', '18:40', 'u8', 'Record replaced by re-sent note', 'CHARGES', 'visit', orig.id, 'Superseded by the incoming payload for record EMR-N-5590911')

  // ---- Scenario: Updated Charges queue (§5.2)
  const sophia = mkVisit('c19', '2026-09-03', 'P1', [['97110', 2], ['97530', 1]], 'Billed')
  const sophiaClaim = mkSent(sophia, 1, '2026-09-04')
  db.updates.push({
    id: 'up1', visitId: sophia.id, claimId: sophiaClaim.id, receivedAt: at('2026-09-14', '19:02'), status: 'Open', practiceId: 'pr1',
    payload: { lines: [{ procedureCodeId: 'pc97110', units: 2, modifiers: ['GP'], pointers: [1] }, { procedureCodeId: 'pc97530', units: 2, modifiers: ['GP'], pointers: [1] }, { procedureCodeId: 'pc97112', units: 1, modifiers: ['GP'], pointers: [1] }], dx: sophia.dx, treatingProviderId: 'P1' },
    wi: S.workItem({ owner: 'u3', due: '2026-09-16', next: 'Choose: inactivate, corrected claim or submit anyway' }),
  })
  A('2026-09-14', '19:02', 'u8', 'Updated note received for a submitted claim', 'CHARGES', 'visit', sophia.id, `Record ${sophia.recordId} → Updated Charges queue`)
  const ethan811 = h22.find((x) => x.v.dos === '2026-08-11')
  db.updates.push({
    id: 'up0', visitId: ethan811.v.id, claimId: ethan811.claim.id, receivedAt: at('2026-09-02', '11:15'), status: 'Inactivated', resolvedOn: '2026-09-02', practiceId: 'pr1',
    payload: { lines: [{ procedureCodeId: 'pc97110', units: 2, modifiers: ['GP'], pointers: [1] }, { procedureCodeId: 'pc97140', units: 1, modifiers: ['GP'], pointers: [1] }, { procedureCodeId: 'pc97530', units: 1, modifiers: ['GP'], pointers: [1] }], dx: ethan811.v.dx, treatingProviderId: 'P1' },
    wi: S.workItem({ owner: 'u6' }),
  })

  // ---- Pending ERA files (§9.1)
  const c2_0901 = h2.find((x) => x.v.dos === '2026-09-01').claim
  const c17_0901 = h17.find((x) => x.v.dos === '2026-09-01').claim
  const eraA = { id: 'eraA', practiceId: 'pr1', insuranceId: 'i1', control: '13202-835-260914-001', received: at('2026-09-14', '06:42'), status: 'Pending', claims: [E.adjudicate(c2_0901, 'paid'), E.adjudicate(c17_0901, 'paid')] }
  // Sequestration adjustment (CO-253) that is not in the mapping list → payment exception on posting
  eraA.claims[1].lines[0].extra = [{ code: 'CO-253', amount: 0.97 }]
  eraA.claims[1].lines[0].paid = U.round(eraA.claims[1].lines[0].paid - 0.97)
  db.eras.unshift(eraA)
  const c1_0825 = h1.find((x) => x.v.dos === '2026-08-25').claim
  const c7_0825 = h7.find((x) => x.v.dos === '2026-08-25').claim
  const eraB = { id: 'eraB', practiceId: 'pr1', insuranceId: 'i3', control: '60054-835-260915-002', received: at('2026-09-15', '06:15'), status: 'Pending', claims: [E.adjudicate(c1_0825, 'paid'), E.adjudicate(c7_0825, 'paid')] }
  eraB.claims.push({ claimId: null, claimNumber: 'HPT-26-099481', patient: 'Unknown patient', outcome: 'paid', lines: [{ lineId: null, cpt: '97110', charge: 76, allowed: 61, contractual: 15, pr: 6.1, prCode: 'PR-2', paid: 54.9, extra: [] }], status: 'pending' })
  db.eras.unshift(eraB)
  A('2026-09-14', '06:42', 'u8', 'ERA (835) received', 'PAYMENTS', 'era', 'eraA', 'Medicare Part B · 2 claims')
  A('2026-09-15', '06:15', 'u8', 'ERA (835) received', 'PAYMENTS', 'era', 'eraB', 'Aetna · 3 claims')

  // A payment exception left over from last week's Aetna ERA
  const lastAetna = db.eras.find((e) => e.insuranceId === 'i3' && e.status === 'Posted' && e.received.startsWith('2026-09-09'))
  if (lastAetna) {
    lastAetna.claims.push({ claimId: null, claimNumber: 'HPT-26-099102', patient: 'Unknown patient', outcome: 'paid', lines: [{ lineId: null, cpt: '97140', charge: 38, allowed: 29.8, contractual: 8.2, pr: 2.98, prCode: 'PR-2', paid: 26.82, extra: [] }], status: 'exception' })
    lastAetna.status = 'Partially posted'
    db.exceptions.push({
      id: U.id('ex'), key: `pay-${lastAetna.id}-${lastAetna.claims.length - 1}`, level: 'Payment', trigger: 'Unmapped payer remittance data',
      detail: 'Claim control number HPT-26-099102 was not found — $26.82 unapplied.', fix: { type: 'era-claim' }, eraId: lastAetna.id,
      eraIdx: lastAetna.claims.length - 1, visitId: null, practiceId: 'pr1', status: 'Open', detectedAt: at('2026-09-09', '07:10'),
      wi: S.workItem({ owner: 'u6', priority: 'High', due: '2026-09-16', next: 'Map the remittance and post it' }),
    })
  }

  // A patient copay taken at the front desk
  const pay1 = db.chargeLines.find((l) => l.balPat > 0)
  if (pay1) {
    const amt = Math.min(15, pay1.balPat)
    pay1.balPat = U.round(pay1.balPat - amt)
    db.payments.push({ id: U.id('pm'), chargeLineId: pay1.id, claimId: null, insuranceId: null, kind: 'Patient payment', amount: amt, reasonCode: '', method: 'Card', checkNumber: 'Card', checkDate: '2026-09-09', postedDate: '2026-09-09', batchId: null })
  }

  // ---- Daily submission runs (§7.2) derived from claim attempts
  const byDay = U.groupBy(db.claims.filter((c) => c.createdOn >= '2026-09-01'), (c) => c.createdOn)
  Object.entries(byDay).forEach(([day, claims]) => {
    const heldReasons = {}
    claims.filter((c) => c.status === 'Hold').forEach((c) => (heldReasons[c.holdReason] = (heldReasons[c.holdReason] || 0) + 1))
    const pids = U.uniq(claims.map((c) => S.patientOfVisit(S.visitOf(c)).practiceId))
    pids.forEach((pid) => {
      const mine = claims.filter((c) => S.patientOfVisit(S.visitOf(c)).practiceId === pid)
      const held = {}
      mine.filter((c) => c.status === 'Hold').forEach((c) => (held[c.holdReason] = (held[c.holdReason] || 0) + 1))
      db.runs.push({ id: U.id('run'), date: day, time: '18:00', mode: 'Scheduled', by: 'Scheduled submission job', ref: `WS${day.replace(/-/g, '')}-018`, claimIds: mine.map((c) => c.id), attempted: mine.length, sent: mine.filter((c) => c.status !== 'Hold').length, held, practiceId: pid })
    })
    void heldReasons
  })
  db.runs.sort((a, b) => U.cmp(b.date + b.time, a.date + a.time))

  // ---- Month-end periods (named in §10.6; workflow unspecified)
  db.periods.push(
    { id: '2026-06', status: 'Closed', closedBy: 'u1', closedOn: '2026-07-03', practiceId: 'pr1' },
    { id: '2026-07', status: 'Closed', closedBy: 'u3', closedOn: '2026-08-04', practiceId: 'pr1' },
    { id: '2026-08', status: 'Closed', closedBy: 'u3', closedOn: '2026-09-03', practiceId: 'pr1' },
    { id: '2026-09', status: 'Open', closedBy: null, closedOn: null, practiceId: 'pr1' },
    { id: '2026-08', status: 'Closed', closedBy: 'u7', closedOn: '2026-09-04', practiceId: 'pr2' },
    { id: '2026-09', status: 'Open', closedBy: null, closedOn: null, practiceId: 'pr2' },
  )

  // ---- EMR payload log (§2.3, §4.2)
  const logEmr = (stamp, locationId, recordId, patient, result, detail) => db.emrLog.push({ id: U.id('emr'), at: stamp, locationId, recordId, patient, result, detail })
  logEmr(at('2026-09-15', '08:30'), 'L1', 'EMR-N-5590402', 'Kevin O’Brien', 'Accepted', 'New record → Charge Review.')
  logEmr(at('2026-09-15', '08:20'), 'L2', 'EMR-N-5590388', 'Maria Gonzalez', 'Accepted', 'New record → Pended (no authorization available).')
  logEmr(at('2026-09-15', '08:12'), 'L1', 'EMR-N-5590371', 'Beatrice Nwosu', 'Accepted', 'New record → Charge Review.')
  logEmr(at('2026-09-15', '08:05'), 'L1', 'EMR-N-5590366', 'Aaliyah Johnson', 'Accepted', 'New record → Charge Review.')
  logEmr(at('2026-09-14', '19:02'), 'L1', sophia.recordId, 'Sophia Russo', 'Updated queue', `Matches submitted claim ${sophiaClaim.number} — stored in the Updated Charges queue.`)
  logEmr(at('2026-09-14', '18:10'), 'L3', 'EMR-N-5590298', 'Walk-in (Staten Island)', 'Blocked', 'Staten Island Annex is EMR-only — payload not accepted into billing.')
  logEmr(at('2026-09-14', '17:25'), 'L1', 'EMR-N-5590290', 'Thomas Reilly', 'Accepted', 'New record → Billing Exceptions ($0.00 CPT 97033).')
  logEmr(at('2026-09-14', '16:10'), 'L2', 'EMR-N-5590271', 'Hannah Levi', 'Accepted', 'New record → Incomplete Profiles bucket (unknown provider).')
  logEmr(at('2026-09-08', '18:40'), 'L1', 'EMR-N-5590911', 'Aaliyah Johnson', 'Replaced', 'Re-sent note replaced the earlier version; old record moved to Inactive Records.')

  // Settle counters so new ids never collide with seeded ones
  U.bumpCounter('v', 5000)
  U.bumpCounter('ln', 9000)
  db.audit.sort((a, b) => U.cmp(b.at, a.at))

  S.quiet = false
  S.session.userId = null
  return db
}
