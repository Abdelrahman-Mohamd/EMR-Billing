import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Insurance } from '@/features/admin-insurances'
import type { Practice } from '@/features/admin-practices'
import type { Provider } from '@/features/admin-providers'
import type { ReferringPhysician } from '@/features/admin-referring-physicians'
import type { Patient } from '@/features/patients'
import { resetBillingExceptions } from '../data/exceptions-store'
import type { BillingException } from '../model/billing-exception'

// Exceptions are frontend only: their in-tab list starts from known records.
// The patients, procedure codes and fee schedules they fix are the
// development samples those features load in tests; the lists that come from
// an api are faked by path, never imported.
// The other features' in-memory lists start empty; seed the records these
// tests read, through each store's own test reset (faked by path — never
// imported, as lint requires).
const seed = vi.hoisted(() => {
  // A patient as the server sends them, parsed: phones as digits, the SSN masked.
  const patient = (id: string, firstName: string, lastName: string, extra: Record<string, unknown> = {}) => ({
    id,
    practiceId: 1,
    billingId: 10400,
    emrId: 56362000,
    firstName,
    middleName: '',
    lastName,
    dob: '1980-01-01',
    gender: 'F',
    genderLabel: 'Female',
    maskedSsn: '',
    phoneCell: '7185550100',
    phoneHome: '',
    email: '',
    address: { line1: '1 Court Street', line2: '', city: 'Brooklyn', state: 'NY', zip: '11201' },
    guarantor: null,
    notes: '',
    noStatements: false,
    isActive: true,
    cases: [],
    ...extra,
  })
  // A case as the server sends it, parsed; its insurance is chosen in the tab (below).
  const patientCase = (patientId: string, name: string, extra: Record<string, unknown> = {}) => ({
    id: `${patientId}-case`,
    patientId,
    name,
    referrerId: 1,
    injuryType: '',
    injuryTypeLabel: '',
    injuryDate: '',
    accidentState: '',
    startOfCare: '2026-09-14',
    dischargeDate: '',
    isActive: true,
    icd10Codes: [],
    ...extra,
  })
  // A case's primary insurance as the server sends it, parsed.
  const coverage = (patientId: string, insuranceId: number, extra: Record<string, unknown> = {}) => ({
    id: `${patientId}-cov-1`,
    caseId: `${patientId}-case`,
    insuranceId,
    insuranceLabel: `${1000 + insuranceId} – Aetna`,
    insuranceName: 'Aetna',
    insuranceType: 'CI',
    rank: 1,
    rankLabel: 'Primary',
    memberId: 'W0001',
    groupNumber: '0001',
    claimNumber: '',
    subscriber: null,
    employer: null,
    effectiveDate: '',
    terminationDate: '',
    ...extra,
  })
  const code = (value: string, description: string, extra: Record<string, unknown> = {}) => ({
    id: Number(value.replace(/\D/g, '')),
    code: value,
    description,
    procedureType: 'therapeutic',
    procedureTypeLabel: 'Therapeutic',
    isTimed: true,
    modifierOverride: false,
    modifiers: [],
    defaultFee: 35,
    isActive: true,
    ...extra,
  })
  return { patient, patientCase, coverage, code }
})
const { SEED_PATIENTS, SEED_CASES, SEED_COVERAGES, SEED_RECORDS, SEED_CODES } = vi.hoisted(() => ({
  SEED_PATIENTS: [
    seed.patient('p10', 'Victor', 'Moreau', { phoneCell: '0000000000' }),
    seed.patient('p11', 'Grace', 'Holloway', {
      address: { line1: '44 Hudson Place', line2: '', city: 'Brooklyn', state: 'NY', zip: '07030' },
    }),
    seed.patient('p12', 'Dmitri', 'Volkov'),
    seed.patient('p14', 'Thomas', 'Reilly'),
    seed.patient('p21', 'Rachel', 'Adler'),
    seed.patient('p25', 'Maximilian Alexander', 'Castellanos-Whitmore', {
      address: {
        line1: '240 Prospect Park Southwest',
        line2: '',
        city: 'Brooklyn',
        state: 'NY',
        zip: '11218',
      },
    }),
  ],
  SEED_CASES: [
    seed.patientCase('p10', 'Plantar fasciitis'),
    seed.patientCase('p12', 'Chronic low back', { referrerId: 5 }),
    seed.patientCase('p14', 'R knee OA'),
  ],
  SEED_COVERAGES: [
    // Someone else is p10's subscriber, with their details still missing.
    seed.coverage('p10', 3, {
      subscriber: { firstName: '', lastName: '', relationship: 'Spouse', dob: '', gender: 'F' },
    }),
    seed.coverage('p12', 3),
    seed.coverage('p14', 3),
  ],
  SEED_RECORDS: {},
  SEED_CODES: [
    seed.code('97033', 'Iontophoresis', {
      defaultFee: 0,
      procedureType: 'modality',
      procedureTypeLabel: 'Modality',
    }),
  ],
}))
// The patients themselves are the server's: faked at their api, answering as it does.
const patientsState = vi.hoisted(() => ({ patients: [] as Patient[] }))
const updatePatientFieldsMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/patients/api/patients-api', () => ({
  listPatients: () => Promise.resolve(structuredClone(patientsState.patients)),
  getPatient: (id: string) => {
    const found = patientsState.patients.find((item) => item.id === id)
    return found ? Promise.resolve(structuredClone(found)) : Promise.reject(new Error('Not found'))
  },
  updatePatientFields: updatePatientFieldsMock,
}))
// So are their cases, and the cases' insurances.
const setSubscriberMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/patients/api/case-insurances-api', () => ({
  listCaseInsurances: () => Promise.resolve(structuredClone(SEED_COVERAGES)),
  setCaseInsuranceSubscriber: setSubscriberMock,
}))
const updateCaseFieldsMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/patients/api/patient-cases-api', () => ({
  listPatientCases: () => Promise.resolve(structuredClone(SEED_CASES)),
  updatePatientCaseFields: updateCaseFieldsMock,
}))
vi.mock('@/features/patients/data/patient-records-store', async (importOriginal) => {
  const actual = await importOriginal<{ resetPatientRecords: (records: object) => void }>()
  actual.resetPatientRecords(SEED_RECORDS)
  return actual
})
const setDefaultFeeMock = vi.hoisted(() => vi.fn())
const createFeeRowMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/admin-fee-schedules/api/fee-schedules-api', () => ({
  listFeeRows: () => Promise.resolve([]),
  createFeeRow: createFeeRowMock,
}))
vi.mock('@/features/admin-procedure-codes/api/procedure-codes-api', () => ({
  listProcedureCodes: () => Promise.resolve(SEED_CODES),
  setProcedureCodeDefaultFee: setDefaultFeeMock,
}))

const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
const insurancesMock = vi.hoisted(() => vi.fn<() => Promise<Insurance[]>>())
const providersMock = vi.hoisted(() => vi.fn<() => Promise<Provider[]>>())
const updateProviderMock = vi.hoisted(() => vi.fn())
const referrersMock = vi.hoisted(() => vi.fn<() => Promise<ReferringPhysician[]>>())
const updateReferrerMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
vi.mock('@/features/admin-insurances/api/insurances-api', () => ({
  listInsurances: insurancesMock,
  createInsurance: vi.fn(),
  updateInsurance: vi.fn(),
}))
vi.mock('@/features/admin-providers/api/providers-api', () => ({
  listProviders: providersMock,
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  correctProviderNpi: updateProviderMock,
}))
vi.mock('@/features/admin-referring-physicians/api/referring-physicians-api', () => ({
  listReferringPhysicians: referrersMock,
  createReferringPhysician: vi.fn(),
  updateReferringPhysician: vi.fn(),
  correctReferringPhysicianNpi: updateReferrerMock,
}))

const practice = (id: number, name: string): Practice => ({
  id,
  organizationId: null,
  code: `P${id}`,
  name,
  dbaName: '',
  npi: '',
  taxId: '',
  taxonomyCode: '',
  address: { line1: '', line2: '', city: '', state: '', zip: '' },
  isActive: true,
  locations: [],
})
const aetna = { id: 3, practiceId: 1, name: 'Aetna' } as unknown as Insurance

const caleb: Provider = {
  id: 6,
  practiceId: 1,
  practiceName: 'Harborline Physical Therapy',
  code: '327',
  firstName: 'Caleb',
  lastName: 'Wright',
  credential: 'PT',
  specialty: 'PHYSICAL THERAPIST',
  type: 'billing',
  typeLabel: 'Billing',
  npi: '',
  taxonomyCode: '225100000X',
  stateLicense: 'NY 048115',
  isActive: true,
}

const referrers: ReferringPhysician[] = [
  {
    id: 1,
    practiceId: 1,
    code: 'PN01',
    name: 'Priya Natarajan, MD',
    type: 'DN',
    typeLabel: 'Referring',
    npi: '1720394851',
    phone: '',
    fax: '',
    isActive: true,
  },
  {
    id: 5,
    practiceId: 1,
    code: 'LV05',
    name: 'Leonard Voss, MD',
    type: 'DN',
    typeLabel: 'Referring',
    npi: '9999999999',
    phone: '8005550199',
    fax: '',
    isActive: true,
  },
]

/** One exception, open, on a session of the given sample patient. */
function exception(
  id: string,
  values: Partial<BillingException> & Pick<BillingException, 'level' | 'trigger' | 'fix'>,
): BillingException {
  return {
    id,
    practiceId: 1,
    detail: `${values.trigger} details.`,
    record: { kind: 'visit', patientId: 'p10', dos: '2026-09-14', recordId: `EMR-${id}` },
    status: 'Open',
    detectedAt: '2026-09-14T17:30',
    owner: null,
    due: '2099-09-17',
    resolvedAt: null,
    resolvedBy: null,
    ...values,
  }
}

const PHONE = exception('ex-phone', {
  level: 'Patient',
  trigger: 'Invalid patient phone number (dummy data)',
  detail: 'Phone 000-000-0000 is placeholder data.',
  fix: { type: 'patient-phone', patientId: 'p10' },
})
const ADDRESS = exception('ex-zip', {
  level: 'Patient',
  trigger: 'ZIP code mismatch with state',
  detail: 'ZIP 07030 belongs to NJ, but the state is NY.',
  record: { kind: 'visit', patientId: 'p11', dos: '2026-09-14', recordId: 'EMR-N-5590204' },
  fix: { type: 'patient-address', patientId: 'p11' },
})
const LENGTH = exception('ex-len', {
  level: 'Patient',
  trigger: 'Character limit exceeded',
  detail: 'Patient name is 41 characters (limit 30).',
  record: { kind: 'visit', patientId: 'p25', dos: '2026-09-14', recordId: 'EMR-N-5590208' },
  fix: { type: 'patient-length', patientId: 'p25' },
})
const REFERRER = exception('ex-ref', {
  level: 'Case',
  trigger: 'Invalid / dummy referring NPI',
  detail: 'Leonard Voss, MD carries NPI 9999999999.',
  record: { kind: 'visit', patientId: 'p12', dos: '2026-09-14', recordId: 'EMR-N-5590205' },
  fix: { type: 'referrer', referrerId: 5, caseId: 'p12-case' },
})
const NPI = exception('ex-npi', {
  level: 'Session',
  trigger: 'Missing mandatory rendering NPI',
  detail: 'Caleb Wright, PT has no NPI on file.',
  record: { kind: 'visit', patientId: 'p21', dos: '2026-09-14', recordId: 'EMR-N-5590207' },
  fix: { type: 'provider-npi', providerId: 6 },
})
const FEE = exception('ex-fee', {
  level: 'Charge',
  trigger: 'New CPT code charged at $0.00',
  detail: '97033 Iontophoresis is missing from the Aetna and default fee schedules.',
  record: { kind: 'visit', patientId: 'p14', dos: '2026-09-14', recordId: 'EMR-N-5590206' },
  fix: { type: 'fee', procedureCode: '97033', insuranceId: 3 },
  owner: 'Tomás Herrera',
  due: '2026-09-17',
})
const PAYMENT = exception('ex-pay', {
  level: 'Payment',
  trigger: 'Unmapped payer remittance data',
  detail: 'Claim control number HPT-26-099102 was not found — $26.82 unapplied.',
  record: { kind: 'era', control: '60054-835-260909', payerName: 'Aetna' },
  fix: { type: 'era-claim' },
  owner: 'Keisha Morgan',
  detectedAt: '2026-09-09T07:10',
})

beforeEach(() => {
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'North Shore Rehab')])
  insurancesMock.mockReset().mockResolvedValue([aetna])
  providersMock.mockReset().mockResolvedValue([caleb])
  updateProviderMock.mockReset().mockResolvedValue('Provider updated successfully')
  setDefaultFeeMock.mockReset().mockResolvedValue('Procedure code updated successfully')
  createFeeRowMock.mockReset().mockResolvedValue('Fee schedule created successfully')
  referrersMock.mockReset().mockResolvedValue(referrers)
  updateReferrerMock.mockReset().mockResolvedValue('Referring physician updated successfully')
  resetBillingExceptions([LENGTH, NPI, FEE, REFERRER, ADDRESS, PHONE, PAYMENT])
  patientsState.patients = structuredClone(SEED_PATIENTS)
  updatePatientFieldsMock.mockReset().mockResolvedValue('Patient updated successfully')
  updateCaseFieldsMock.mockReset().mockResolvedValue('Patient case updated successfully')
  setSubscriberMock.mockReset().mockResolvedValue('Case insurance updated successfully')
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path: string) {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return router
}
const toasts = () => useToastStore.getState().toasts
const table = () => screen.findByRole('table', { name: 'Billing exceptions' }, { timeout: 5000 })
const rowOf = async (text: string) =>
  (await within(await table()).findByText(text, undefined, { timeout: 5000 })).closest('tr') as HTMLElement
const resolve = async (trigger: string) => {
  const row = await rowOf(trigger)
  await userEvent.click(
    within(row).getByRole('button', { name: new RegExp(`^Resolve ${trigger.replace(/[$()/.]/g, '\\$&')}`) }),
  )
  return screen.findByRole('dialog')
}

describe('Exceptions — the lists', () => {
  it('shows the open billing exceptions as the prototype does', async () => {
    renderAt('/exceptions')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Exceptions' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: 'Exception lists' })
    expect(within(tabs).getByRole('link', { name: 'Billing exceptions 7' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(tabs).getByRole('link', { name: 'Incomplete profiles 0' })).toBeInTheDocument()
    expect(within(tabs).getByRole('link', { name: 'Resolved 0' })).toBeInTheDocument()
    const pills = screen.getByRole('group', { name: 'Filter by level' })
    expect(
      within(pills)
        .getAllByRole('button')
        .map((pill) => pill.textContent),
    ).toEqual(['Patient 3', 'Case 1', 'Session 1', 'Charge 1', 'Payment 1'])

    // Newest first; the record is the patient's session, or the remittance.
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows).toHaveLength(7)
    const fee = await rowOf('New CPT code charged at $0.00')
    expect(fee).toHaveTextContent('97033 Iontophoresis is missing from the Aetna and default fee schedules.')
    expect(await within(fee).findByText('Reilly, Thomas', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(fee).toHaveTextContent('DOS 09/14/2026 · record EMR-N-5590206')
    expect(fee).toHaveTextContent('Tomás Herrera')
    // Past its due date: marked, and said so.
    expect(within(fee).getByText('(overdue)', { exact: false })).toBeInTheDocument()
    expect(await rowOf('Missing mandatory rendering NPI')).toHaveTextContent('Unassigned')

    // Payment-level exceptions are fixed against claims and remittances: no Resolve here.
    const payment = await rowOf('Unmapped payer remittance data')
    expect(payment).toHaveTextContent('ERA 60054-835-260909')
    expect(payment).toHaveTextContent('Aetna')
    expect(within(payment).queryByRole('button', { name: /^Resolve/ })).not.toBeInTheDocument()
  }, 15_000)

  it('filters by level, and a link can open it on one level', async () => {
    renderAt('/exceptions')
    const pills = await screen.findByRole('group', { name: 'Filter by level' }, { timeout: 5000 })
    await userEvent.click(within(pills).getByRole('button', { name: 'Patient 3' }))
    expect(
      within(await table())
        .getAllByRole('row')
        .slice(1),
    ).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Show all levels' }))
    expect(
      within(await table())
        .getAllByRole('row')
        .slice(1),
    ).toHaveLength(7)
  })

  it('opens on one level from a link (?level=Payment)', async () => {
    renderAt('/exceptions?level=Payment')
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('Unmapped payer remittance data')
    expect(screen.getByRole('button', { name: 'Payment 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('narrows to a practice (?practice=)', async () => {
    resetBillingExceptions([PHONE, { ...ADDRESS, practiceId: 2 }])
    renderAt('/exceptions?practice=2')
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent('ZIP code mismatch with state')
  })

  it('says so when there is nothing to show', async () => {
    resetBillingExceptions([])
    const router = renderAt('/exceptions')
    expect(await screen.findByText('No open billing exceptions', undefined, { timeout: 5000 })).toBeVisible()
    await userEvent.click(screen.getByRole('link', { name: 'Resolved 0' }))
    expect(await screen.findByText('Nothing resolved yet')).toBeVisible()
    expect(router.state.location.pathname).toBe('/exceptions/resolved')
    await userEvent.click(screen.getByRole('link', { name: 'Incomplete profiles 0' }))
    expect(await screen.findByText('No incomplete profiles')).toBeVisible()
  })
})

describe('Exceptions — resolving', () => {
  it('fixes a placeholder phone: refuses another placeholder, then saves and resolves', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Invalid patient phone number (dummy data)')
    expect(within(dialog).getByRole('heading', { name: 'Fix phone — Victor Moreau' })).toBeInTheDocument()
    expect(
      within(dialog).getByText('Patient · Invalid patient phone number (dummy data).'),
    ).toBeInTheDocument()
    // The placeholder is not offered back.
    const cell = within(dialog).getByRole('textbox', { name: /cell phone/i })
    expect(cell).toHaveValue('')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter a phone number.')).toBeVisible()
    await userEvent.type(cell, '111-111-1111')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Please enter a valid phone number.')).toBeVisible()

    await userEvent.clear(cell)
    await userEvent.type(cell, '718-555-0177')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([
      expect.objectContaining({ tone: 'success', title: 'Patient updated — exception resolved' }),
    ])
    expect(screen.getByRole('link', { name: 'Billing exceptions 6' })).toBeInTheDocument()
    expect(screen.queryByText('Invalid patient phone number (dummy data)')).not.toBeInTheDocument()

    // The patient record itself was corrected on the server — the phones alone.
    expect(updatePatientFieldsMock).toHaveBeenCalledWith('p10', {
      phone_cell: '7185550177',
      phone_home: null,
    })

    // And the exception is in Resolved.
    await userEvent.click(screen.getByRole('link', { name: 'Resolved 1' }))
    const resolved = await screen.findByRole('table', { name: 'Resolved exceptions' })
    expect(within(resolved).getByText('Invalid patient phone number (dummy data)')).toBeInTheDocument()
  }, 20_000)

  it('says when the same visit still has exceptions after a fix', async () => {
    resetBillingExceptions([
      PHONE,
      { ...ADDRESS, record: PHONE.record, fix: { type: 'patient-address', patientId: 'p10' } },
    ])
    renderAt('/exceptions')
    const dialog = await resolve('Invalid patient phone number (dummy data)')
    const cell = within(dialog).getByRole('textbox', { name: /cell phone/i })
    await userEvent.clear(cell)
    await userEvent.type(cell, '718-555-0177')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([
      expect.objectContaining({
        tone: 'warning',
        title: 'Patient updated — but the visit still has 1 exception',
        description: 'ZIP code mismatch with state',
      }),
    ])
  }, 15_000)

  it('fixes an address: the ZIP code must belong to the state', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('ZIP code mismatch with state')
    expect(
      within(dialog).getByText('ZIP codes are cross-referenced against the state. 07030 belongs to NJ.'),
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Please enter a valid ZIP code.')).toBeVisible()
    const zip = within(dialog).getByRole('textbox', { name: /^zip/i })
    await userEvent.clear(zip)
    await userEvent.type(zip, '11201')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updatePatientFieldsMock).toHaveBeenCalledWith('p11', {
      address: '44 Hudson Place',
      city: 'Brooklyn',
      state: 'NY',
      zip_code: '11201',
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Patient updated — exception resolved' })])
  }, 15_000)

  it('fixes a name that is too long, with the shortened version offered', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Character limit exceeded')
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'Fill in a truncated version (name 30, address 35 characters)',
      }),
    )
    expect(within(dialog).getByRole('textbox', { name: /first name/i })).toHaveValue('Maximilian')
    expect(within(dialog).getByRole('textbox', { name: /middle name/i })).toHaveValue('')
    expect(toasts()).toEqual([expect.objectContaining({ tone: 'info', title: 'Truncated values filled in' })])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updatePatientFieldsMock).toHaveBeenCalledWith(
      'p25',
      expect.objectContaining({ first_name: 'Maximilian', middle_name: null }),
    )
  }, 15_000)

  it('corrects a dummy referring NPI on the directory profile', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Invalid / dummy referring NPI')
    expect(within(dialog).getByRole('radio', { name: /Correct Leonard Voss, MD’s NPI/ })).toBeChecked()
    const npi = within(dialog).getByRole('textbox', { name: /correct npi/i })
    await userEvent.type(npi, '1234567890')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Please enter a valid NPI.')).toBeVisible()
    await userEvent.clear(npi)
    await userEvent.type(npi, '1609873452')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // The NPI alone: the rest of the profile (its phone, its status) stays as it is.
    expect(updateReferrerMock).toHaveBeenCalledWith(5, '1609873452')
    expect(toasts()).toEqual([
      expect.objectContaining({ title: 'Referring physician fixed — exception resolved' }),
    ])
  }, 15_000)

  it('or gives the case another referring physician', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Invalid / dummy referring NPI')
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Use a different referring physician on this case' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Select the referring physician.')).toBeVisible()
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^referring physician/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Priya Natarajan, MD' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateReferrerMock).not.toHaveBeenCalled()
    // The case's physician alone, on the server.
    expect(updateCaseFieldsMock).toHaveBeenCalledWith('p12-case', { referring_physician_id: 1 })
  }, 15_000)

  it('adds the rendering NPI on the provider — and keeps the dialog open if the save fails', async () => {
    updateProviderMock.mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'offline' }))
    renderAt('/exceptions')
    const dialog = await resolve('Missing mandatory rendering NPI')
    expect(
      within(dialog).getByRole('heading', { name: 'Add rendering NPI — Caleb Wright, PT' }),
    ).toBeInTheDocument()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /individual npi/i }), '1528461903')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(
      await within(dialog).findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeVisible()
    // Nothing was resolved. (The page behind an open dialog is hidden from the accessibility tree.)
    expect(screen.getByRole('link', { name: 'Billing exceptions 7', hidden: true })).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // The NPI alone: the rest of the provider stays as it is.
    expect(updateProviderMock).toHaveBeenLastCalledWith(6, '1528461903')
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Provider NPI saved — exception resolved' })])
  }, 15_000)

  it('prices a code charged at $0.00: a default fee, the payer’s rate, or both', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('New CPT code charged at $0.00')
    expect(within(dialog).getByRole('heading', { name: 'Price 97033 — Iontophoresis' })).toBeInTheDocument()
    // Why the default fee matters is behind its info icon, not under the field.
    expect(
      within(dialog).getByRole('button', { name: 'About Default fee per unit' }),
    ).toHaveAccessibleDescription('Used when no payer row matches.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter the default fee.')).toBeVisible()

    await userEvent.type(within(dialog).getByRole('textbox', { name: /default fee per unit/i }), '18.50')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /billed per unit/i }), '22')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([expect.objectContaining({ title: '97033 priced — exception resolved' })])

    // The default fee alone, on the server's code.
    expect(setDefaultFeeMock).toHaveBeenCalledWith(97033, 18.5)
    // The payer's row, for this year, on the server.
    const year = new Date().getFullYear()
    expect(createFeeRowMock).toHaveBeenCalledWith(3, {
      procedureCodeId: '97033',
      billed: '22',
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    })
  }, 20_000)

  it('completes a missing case field, and a subscriber’s details', async () => {
    resetBillingExceptions([
      exception('ex-case', {
        level: 'Case',
        trigger: 'Missing mandatory EMR case fields',
        detail: 'The injury / onset date is missing.',
        fix: { type: 'case', caseId: 'p10-case', field: 'injuryDate' },
      }),
      exception('ex-sub', {
        level: 'Case',
        trigger: 'Missing subscriber details',
        detail: 'Primary insurance subscriber details are incomplete.',
        record: { kind: 'visit', patientId: 'p10', dos: '2026-09-15', recordId: 'EMR-other' },
        fix: { type: 'coverage', coverageId: 'p10-cov-1' },
      }),
    ])
    renderAt('/exceptions')
    let dialog = await resolve('Missing mandatory EMR case fields')
    expect(
      within(dialog).getByRole('heading', { name: 'Complete case fields — Plantar fasciitis' }),
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter the injury or onset date.')).toBeVisible()
    // The prototype's employment status is not in the case contract.
    expect(within(dialog).queryByRole('textbox', { name: /employment status/i })).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /injury \/ onset date/i }), '09/01/2026')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Case updated — exception resolved' })])
    // What is filled in — the date, and the physician the case already had — and nothing else.
    expect(updateCaseFieldsMock).toHaveBeenCalledWith('p10-case', {
      injury_date: '2026-09-01',
      referring_physician_id: 1,
    })

    dialog = await resolve('Missing subscriber details')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter the subscriber’s first name.')).toBeVisible()
    expect(within(dialog).getByText('Enter the subscriber’s last name.')).toBeVisible()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^first name/i }), 'Claire')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^last name/i }), 'Moreau')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /subscriber dob/i }), '03/02/1974')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // The subscriber alone, on the case's insurance — keeping its relationship and gender.
    expect(setSubscriberMock).toHaveBeenCalledWith('p10-cov-1', {
      first_name: 'Claire',
      last_name: 'Moreau',
      date_of_birth: '1974-03-02',
      relationship: 'Spouse',
      gender: 'F',
    })
  }, 25_000)
})
