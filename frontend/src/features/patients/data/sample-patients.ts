import type { Authorization } from '../model/authorization'
import type { PatientCase } from '../model/case'
import type { Coverage } from '../model/coverage'
import type { Patient } from '../model/patient'
import type { Icd10Code } from './patient-records-store'

/**
 * TEMPORARY DEVELOPMENT DATA — invented people, not records from any system.
 *
 * A selection of the prototype's patients, cases, coverage and authorizations,
 * and its ICD-10 list, so the screens can be seen with content in development
 * and tests. They point at the development mocks' ids: practices 1 and 2,
 * insurances 1–10 (the prototype's i1–i8; i10 → 9, i11 → 10) and referring
 * physicians 1–7 (R1–R7). One guarantor, with an address, is added so the
 * Guarantor section can be seen filled in (the prototype seeds none).
 *
 * Loaded only when `__MOCK_DATA__` is true (see `patient-records-store.ts`),
 * so a production build never contains it. The SSNs are of the prototype's
 * invented kind and are only ever shown masked.
 */
const ICD10: readonly Icd10Code[] = [
  ['M54.50', 'Low back pain, unspecified'],
  ['M54.2', 'Cervicalgia'],
  ['M25.511', 'Pain in right shoulder'],
  ['M25.512', 'Pain in left shoulder'],
  ['M25.561', 'Pain in right knee'],
  ['M25.562', 'Pain in left knee'],
  ['M75.101', 'Unspecified rotator cuff tear of right shoulder, not traumatic'],
  ['M75.41', 'Impingement syndrome of right shoulder'],
  ['S83.511D', 'Sprain of anterior cruciate ligament of right knee, subsequent encounter'],
  ['S93.401D', 'Sprain of unspecified ligament of right ankle, subsequent encounter'],
  ['S13.4XXD', 'Sprain of ligaments of cervical spine, subsequent encounter'],
  ['S33.5XXD', 'Sprain of ligaments of lumbar spine, subsequent encounter'],
  ['M17.11', 'Unilateral primary osteoarthritis, right knee'],
  ['M17.12', 'Unilateral primary osteoarthritis, left knee'],
  ['M62.81', 'Muscle weakness (generalized)'],
  ['R26.89', 'Other abnormalities of gait and mobility'],
  ['R26.2', 'Difficulty in walking'],
  ['Z96.652', 'Presence of left artificial knee joint'],
  ['Z47.1', 'Aftercare following joint replacement surgery'],
  ['M51.26', 'Other intervertebral disc displacement, lumbar region'],
  ['S92.352D', 'Displaced fracture of fifth metatarsal bone, left foot, subsequent encounter'],
  ['M76.61', 'Achilles tendinitis, right leg'],
  ['M72.2', 'Plantar fascial fibromatosis'],
  ['M79.641', 'Pain in right hand'],
  ['G89.29', 'Other chronic pain'],
  ['S46.011D', 'Strain of muscle and tendon of rotator cuff of right shoulder, subsequent encounter'],
].map(([code, description]) => ({ code: code ?? '', description: description ?? '' }))

const describe = (code: string) => ({
  code,
  description: ICD10.find((item) => item.code === code)?.description ?? '',
})

const patients: Patient[] = []
const cases: PatientCase[] = []
const coverages: Coverage[] = []
let billingId = 10412
let emrId = 56361642

interface Seed {
  id: string
  practiceId?: number
  firstName: string
  lastName: string
  gender: string
  dob: string
  address: [line1: string, city: string, state: string, zip: string]
  phoneCell?: string
  phoneHome?: string
  email?: string
  ssn?: string
  guarantor?: Patient['guarantor']
  case: {
    name: string
    referrerId: number
    injuryType?: string
    injuryDate?: string
    accidentState?: string
    employmentStatus?: string
    startOfCare: string
    dx: string[]
  }
  coverage: Array<
    Omit<Coverage, 'id' | 'patientId' | 'claimNumber' | 'subscriber' | 'employer'> & Partial<Coverage>
  >
}

function seed(s: Seed): void {
  const [line1, city, state, zip] = s.address
  patients.push({
    id: s.id,
    practiceId: s.practiceId ?? 1,
    billingId: billingId++,
    emrId: (emrId += 131),
    firstName: s.firstName,
    middleName: '',
    lastName: s.lastName,
    dob: s.dob,
    gender: s.gender,
    ssn: s.ssn ?? '',
    phoneCell: s.phoneCell ?? '',
    phoneHome: s.phoneHome ?? '',
    email: s.email ?? '',
    address: { line1, line2: '', city, state, zip },
    guarantor: s.guarantor ?? null,
    notes: '',
    isActive: true,
  })
  const caseId = `${s.id}-case`
  const ids = s.coverage.map((coverage, index) => {
    const id = `${s.id}-cov-${index + 1}`
    coverages.push({ claimNumber: '', subscriber: null, employer: null, ...coverage, id, patientId: s.id })
    return id
  })
  cases.push({
    id: caseId,
    patientId: s.id,
    name: s.case.name,
    referrerId: s.case.referrerId,
    primaryCoverageId: ids[0] ?? null,
    secondaryCoverageId: ids[1] ?? null,
    injuryType: s.case.injuryType ?? '',
    injuryDate: s.case.injuryDate ?? '',
    accidentState: s.case.accidentState ?? '',
    employmentStatus: s.case.employmentStatus ?? '',
    startOfCare: s.case.startOfCare,
    dischargeDate: '',
    isActive: true,
    diagnoses: s.case.dx.map(describe),
  })
}

seed({
  id: 'p1',
  firstName: 'Nadia',
  lastName: 'Okonkwo',
  gender: 'Female',
  dob: '1984-06-12',
  address: ['412 Ovington Avenue', 'Brooklyn', 'NY', '11209'],
  phoneCell: '718-555-0142',
  email: 'nadia.o@example.com',
  ssn: '412-55-7781',
  case: {
    name: 'R shoulder 2026',
    referrerId: 1,
    injuryDate: '2026-07-28',
    startOfCare: '2026-08-04',
    dx: ['M75.101', 'M25.511'],
  },
  coverage: [{ insuranceId: 3, memberId: 'W284019733', groupNumber: '0184421' }],
})
seed({
  id: 'p2',
  firstName: 'Harold',
  lastName: 'Brennan',
  gender: 'Male',
  dob: '1951-02-03',
  address: ['7520 Ridge Boulevard', 'Brooklyn', 'NY', '11209'],
  phoneCell: '718-555-0178',
  phoneHome: '718-555-0179',
  ssn: '208-44-1937',
  case: {
    name: 'L knee TKA rehab',
    referrerId: 2,
    injuryDate: '2026-06-30',
    startOfCare: '2026-07-07',
    dx: ['Z96.652', 'Z47.1', 'M62.81'],
  },
  coverage: [
    { insuranceId: 1, memberId: '1EG4-TE5-MK72', groupNumber: 'NONE' },
    { insuranceId: 8, memberId: '38291744011', groupNumber: 'AARP-F' },
  ],
})
seed({
  id: 'p3',
  firstName: 'Maria',
  lastName: 'Gonzalez',
  gender: 'Female',
  dob: '1976-09-21',
  address: ['331 5th Street', 'Brooklyn', 'NY', '11215'],
  phoneCell: '718-555-0156',
  email: 'mgonzalez@example.com',
  case: {
    name: 'Lumbar strain',
    referrerId: 3,
    injuryDate: '2026-06-22',
    startOfCare: '2026-07-14',
    dx: ['M54.50', 'M51.26'],
  },
  coverage: [{ insuranceId: 2, memberId: 'XEH849301266', groupNumber: '140233' }],
})
seed({
  id: 'p4',
  firstName: 'James',
  lastName: 'Whitaker',
  gender: 'Male',
  dob: '1969-11-02',
  address: ['88 Marine Avenue', 'Brooklyn', 'NY', '11209'],
  phoneCell: '718-555-0163',
  case: { name: 'Neck pain', referrerId: 1, startOfCare: '2026-08-18', dx: ['M54.2', 'S13.4XXD'] },
  coverage: [{ insuranceId: 4, memberId: '918273645', groupNumber: '705214' }],
})
seed({
  id: 'p5',
  firstName: 'Linda',
  lastName: 'Park',
  gender: 'Female',
  dob: '1990-04-17',
  address: ['59 Prospect Park West', 'Brooklyn', 'NY', '11215'],
  phoneCell: '718-555-0191',
  case: {
    name: 'Auto accident 08/2026',
    referrerId: 1,
    injuryType: 'Auto',
    injuryDate: '2026-08-09',
    accidentState: 'NY',
    startOfCare: '2026-08-20',
    dx: ['S13.4XXD', 'M54.2'],
  },
  coverage: [
    { insuranceId: 6, memberId: 'GNF-7731902', groupNumber: 'NF-NY-01', claimNumber: '0547-88213-01' },
  ],
})
seed({
  id: 'p6',
  firstName: 'Robert',
  lastName: 'Chen',
  gender: 'Male',
  dob: '1958-12-30',
  address: ['1402 Bay Ridge Parkway', 'Brooklyn', 'NY', '11228'],
  phoneCell: '718-555-0115',
  case: {
    name: 'R shoulder — work injury',
    referrerId: 4,
    injuryType: 'Employment Related',
    injuryDate: '2026-07-14',
    employmentStatus: 'Employed full time',
    startOfCare: '2026-07-16',
    dx: ['S46.011D', 'M25.511'],
  },
  coverage: [
    {
      insuranceId: 5,
      memberId: 'WC-4417260',
      groupNumber: 'EMP-22019',
      claimNumber: '1439WC260300330',
      employer: { name: 'Atlas Freight LLC', address: '90 Hamilton Avenue, Brooklyn, NY 11231' },
    },
  ],
})
seed({
  id: 'p7',
  firstName: 'Aaliyah',
  lastName: 'Johnson',
  gender: 'Female',
  dob: '1995-03-08',
  address: ['272 Senator Street', 'Brooklyn', 'NY', '11220'],
  phoneCell: '718-555-0127',
  email: 'aaliyah.j@example.com',
  case: {
    name: 'R ankle sprain',
    referrerId: 4,
    injuryDate: '2026-07-30',
    startOfCare: '2026-08-04',
    dx: ['S93.401D', 'M25.561'],
  },
  coverage: [{ insuranceId: 3, memberId: 'W771025846', groupNumber: '0190877' }],
})
seed({
  id: 'p8',
  firstName: 'Samuel',
  lastName: 'Adeyemi',
  gender: 'Male',
  dob: '1988-07-25',
  address: ['145 Garfield Place', 'Brooklyn', 'NY', '11215'],
  phoneCell: '718-555-0149',
  case: {
    name: 'ACL reconstruction',
    referrerId: 2,
    injuryDate: '2026-07-02',
    startOfCare: '2026-07-21',
    dx: ['S83.511D', 'M25.561'],
  },
  coverage: [{ insuranceId: 7, memberId: 'U58210334', groupNumber: '3340917' }],
})
seed({
  id: 'p9',
  firstName: 'Eleanor',
  lastName: 'Fitzgerald',
  gender: 'Female',
  dob: '1945-05-19',
  address: ['9201 Shore Road', 'Brooklyn', 'NY', '11209'],
  phoneHome: '718-555-0106',
  // Development illustration of the Guarantor section; the prototype seeds none.
  guarantor: {
    name: 'Claire Fitzgerald',
    relationship: 'Child',
    address: { line1: '140 Clinton Street', city: 'Brooklyn', state: 'NY', zip: '11201' },
  },
  case: { name: 'Gait & balance', referrerId: 2, startOfCare: '2026-08-26', dx: ['R26.89', 'M62.81'] },
  coverage: [{ insuranceId: 1, memberId: '3HT7-QW2-PL19', groupNumber: 'NONE' }],
})
seed({
  id: 'p11',
  firstName: 'Grace',
  lastName: 'Holloway',
  gender: 'Female',
  dob: '1981-01-29',
  address: ['44 Hudson Place', 'Brooklyn', 'NY', '07030'],
  phoneCell: '718-555-0133',
  case: { name: 'L shoulder impingement', referrerId: 1, startOfCare: '2026-09-14', dx: ['M25.512'] },
  coverage: [{ insuranceId: 2, memberId: 'XEH551209873', groupNumber: '140233' }],
})
seed({
  id: 'p18',
  firstName: 'Kevin',
  lastName: 'O’Brien',
  gender: 'Male',
  dob: '1974-03-19',
  address: ['155 Bay Ridge Avenue', 'Brooklyn', 'NY', '11220'],
  phoneCell: '718-555-0188',
  case: { name: 'Lumbar disc', referrerId: 3, startOfCare: '2026-08-03', dx: ['M51.26', 'M54.50'] },
  // The prototype's example of a missing group number.
  coverage: [{ insuranceId: 2, memberId: 'XEH338120945', groupNumber: '' }],
})
seed({
  id: 'p25',
  firstName: 'Maximilian Alexander',
  lastName: 'Castellanos-Whitmore',
  gender: 'Male',
  dob: '1968-11-21',
  address: ['240 Prospect Park Southwest', 'Brooklyn', 'NY', '11218'],
  phoneCell: '718-555-0197',
  case: { name: 'R hip', referrerId: 1, startOfCare: '2026-09-14', dx: ['M62.81'] },
  coverage: [{ insuranceId: 3, memberId: 'W118829930', groupNumber: '0190877' }],
})
seed({
  id: 'p30',
  practiceId: 2,
  firstName: 'Isabella',
  lastName: 'Marino',
  gender: 'Female',
  dob: '1950-08-02',
  address: ['12 Station Plaza', 'Great Neck', 'NY', '11021'],
  phoneCell: '516-555-0141',
  case: { name: 'L hip OA', referrerId: 7, startOfCare: '2026-08-05', dx: ['M62.81', 'R26.2'] },
  coverage: [{ insuranceId: 9, memberId: '2WE8-TY4-KL90', groupNumber: 'NONE' }],
})
seed({
  id: 'p31',
  practiceId: 2,
  firstName: 'Frank',
  lastName: 'Delgado',
  gender: 'Male',
  dob: '1977-12-14',
  address: ['88 Middle Neck Road', 'Great Neck', 'NY', '11021'],
  phoneCell: '516-555-0156',
  case: { name: 'Lumbar strain', referrerId: 7, startOfCare: '2026-08-06', dx: ['M54.50'] },
  coverage: [{ insuranceId: 10, memberId: 'W881203347', groupNumber: '0210044' }],
})

// The prototype's patients behind its billing exceptions (features/exceptions):
// a placeholder phone (p10), a case whose referring physician carries a dummy
// NPI (p12, Leonard Voss), a code charged at $0.00 (p14) and a session whose
// rendering provider has no NPI (p21). Added last so the others' Billing IDs
// stay as they were.
seed({
  id: 'p10',
  firstName: 'Victor',
  lastName: 'Moreau',
  gender: 'Male',
  dob: '1972-08-14',
  address: ['610 3rd Street', 'Brooklyn', 'NY', '11215'],
  phoneCell: '000-000-0000',
  case: { name: 'Plantar fasciitis', referrerId: 3, startOfCare: '2026-09-14', dx: ['M72.2'] },
  coverage: [{ insuranceId: 3, memberId: 'W390112784', groupNumber: '0184421' }],
})
seed({
  id: 'p12',
  firstName: 'Dmitri',
  lastName: 'Volkov',
  gender: 'Male',
  dob: '1966-10-05',
  address: ['7811 4th Avenue', 'Brooklyn', 'NY', '11209'],
  phoneCell: '718-555-0184',
  case: { name: 'Chronic low back', referrerId: 5, startOfCare: '2026-09-14', dx: ['M54.50', 'G89.29'] },
  coverage: [{ insuranceId: 3, memberId: 'W118870451', groupNumber: '0177230' }],
})
seed({
  id: 'p14',
  firstName: 'Thomas',
  lastName: 'Reilly',
  gender: 'Male',
  dob: '1979-06-02',
  address: ['8410 Colonial Road', 'Brooklyn', 'NY', '11209'],
  phoneCell: '718-555-0120',
  case: { name: 'R knee OA', referrerId: 2, startOfCare: '2026-09-14', dx: ['M17.11'] },
  coverage: [{ insuranceId: 3, memberId: 'W660291357', groupNumber: '0190877' }],
})
seed({
  id: 'p21',
  firstName: 'Rachel',
  lastName: 'Adler',
  gender: 'Female',
  dob: '1970-10-10',
  address: ['503 Carroll Street', 'Brooklyn', 'NY', '11215'],
  phoneCell: '718-555-0145',
  case: { name: 'R shoulder impingement', referrerId: 1, startOfCare: '2026-08-25', dx: ['M75.41'] },
  coverage: [{ insuranceId: 7, memberId: 'U58219921', groupNumber: '3340917' }],
})

// One patient inactive, as the roster's Status filter needs one to show.
const inactive = patients.find((patient) => patient.id === 'p11')
if (inactive !== undefined) inactive.isActive = false

const authorizations: Authorization[] = [
  {
    id: 'a1',
    caseId: 'p3-case',
    coverageId: 'p3-cov-1',
    number: '0VJL671TT',
    start: '2026-07-10',
    end: '2026-09-07',
    qty: 6,
    unit: 'Visits',
    used: 0,
  },
  {
    id: 'a2',
    caseId: 'p4-case',
    coverageId: 'p4-cov-1',
    number: 'UHC-2026-55120',
    start: '2026-08-01',
    end: '2026-10-31',
    qty: 12,
    unit: 'Visits',
    used: 5,
  },
  {
    id: 'a5',
    caseId: 'p18-case',
    coverageId: 'p18-cov-1',
    number: 'BC-2026-90155',
    start: '2026-08-01',
    end: '2026-10-31',
    qty: 20,
    unit: 'Visits',
    used: 0,
  },
  {
    id: 'a6',
    caseId: 'p6-case',
    coverageId: 'p6-cov-1',
    number: 'WC-AUTH-33871',
    start: '2026-07-15',
    end: '2026-10-15',
    qty: 24,
    unit: 'Visits',
    used: 0,
  },
]

export const SAMPLE_RECORDS = { patients, cases, coverages, authorizations, icd10: ICD10 }
