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
import {
  deleteBillingException,
  getExceptionGroups,
  listBillingExceptions,
  reprocessBillingException,
  scanPractice,
  type ExceptionFilter,
} from '../api/billing-exceptions-api'
import { reasonLabel, typeLabel, type BillingException } from '../model/billing-exception'

// The billing exceptions are the server's: faked at their api, answering as it
// does — filtered by practice, type and reason, counted by type and reason, a
// re-check clearing the exception unless a test says the problem is still
// there. The records they are fixed on are other features' integration points:
// faked by path, never imported (lint forbids it).
vi.mock('../api/billing-exceptions-api', () => ({
  listBillingExceptions: vi.fn(),
  getExceptionGroups: vi.fn(),
  scanPractice: vi.fn(),
  reprocessBillingException: vi.fn(),
  deleteBillingException: vi.fn(),
}))
const listMock = vi.mocked(listBillingExceptions)
const groupsMock = vi.mocked(getExceptionGroups)
const scanMock = vi.mocked(scanPractice)
const reprocessMock = vi.mocked(reprocessBillingException)
const deleteMock = vi.mocked(deleteBillingException)
let exceptions: BillingException[]
// A visit is read on its own for its treating provider and lines.
const getVisitMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/visits/api/visits-api', () => ({ getVisit: getVisitMock, listVisits: vi.fn() }))

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
    diagnoses: [],
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
const { SEED_PATIENTS, SEED_CASES, SEED_COVERAGES, SEED_CODES } = vi.hoisted(() => ({
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

/** An exception as the server lists it, parsed. */
function exception(
  id: number,
  values: Pick<BillingException, 'type' | 'reason' | 'detail'> & Partial<BillingException>,
  patient: [id: string, first: string, last: string] = ['p10', 'Victor', 'Moreau'],
): BillingException {
  return {
    id,
    practiceId: 1,
    level: typeLabel(values.type),
    trigger: reasonLabel(values.reason),
    patientId: patient[0],
    patientFirstName: patient[1],
    patientLastName: patient[2],
    caseId: null,
    visitId: null,
    visitDate: '',
    chargeLineId: null,
    detectedAt: `2026-10-20T1${id % 10}:00:00.000000Z`,
    ...values,
  }
}

const PHONE = exception(1, {
  type: 'patient',
  reason: 'placeholder_phone',
  detail: 'The cell phone 000-000-0000 looks like placeholder data.',
})
const ADDRESS = exception(
  2,
  { type: 'patient', reason: 'zip_state_mismatch', detail: 'ZIP code 07030 does not belong to NY.' },
  ['p11', 'Grace', 'Holloway'],
)
const LENGTH = exception(
  3,
  { type: 'patient', reason: 'field_too_long', detail: 'The patient’s name is 41 characters (limit 30).' },
  ['p25', 'Maximilian Alexander', 'Castellanos-Whitmore'],
)
const REFERRER = exception(
  4,
  {
    type: 'case',
    reason: 'invalid_referring_npi',
    detail: 'The referring physician’s NPI 9999999999 is a placeholder or fails the NPI check digit.',
    caseId: 'p12-case',
  },
  ['p12', 'Dmitri', 'Volkov'],
)
const NO_PRIMARY = exception(5, {
  type: 'case',
  reason: 'no_primary_insurance',
  detail: 'The case has no primary insurance.',
  caseId: 'p10-case',
})
const NPI = exception(
  6,
  {
    type: 'charge',
    reason: 'invalid_rendering_npi',
    detail: 'The treating provider’s NPI is missing.',
    caseId: 'p14-case',
    visitId: 41,
    visitDate: '2026-09-14',
  },
  ['p14', 'Thomas', 'Reilly'],
)
const FEE = exception(
  7,
  {
    type: 'charge',
    reason: 'zero_amount',
    detail: 'Line 97033 is charged at $0.00.',
    caseId: 'p14-case',
    visitId: 41,
    visitDate: '2026-09-14',
    chargeLineId: 70,
  },
  ['p14', 'Thomas', 'Reilly'],
)
const NO_DX = exception(
  8,
  {
    type: 'charge',
    reason: 'no_diagnosis',
    detail: 'The visit has no diagnosis codes.',
    caseId: 'p14-case',
    visitId: 41,
    visitDate: '2026-09-14',
  },
  ['p14', 'Thomas', 'Reilly'],
)
const ALL = [PHONE, ADDRESS, LENGTH, REFERRER, NO_PRIMARY, NPI, FEE, NO_DX]

/** As the server filters the list. */
const matching = (filter: ExceptionFilter) =>
  exceptions.filter(
    (item) =>
      (filter.practiceId === undefined || item.practiceId === filter.practiceId) &&
      (filter.type === undefined || item.type === filter.type) &&
      (filter.reason === undefined || item.reason === filter.reason),
  )

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
  patientsState.patients = structuredClone(SEED_PATIENTS)
  updatePatientFieldsMock.mockReset().mockResolvedValue('Patient updated successfully')
  updateCaseFieldsMock.mockReset().mockResolvedValue('Patient case updated successfully')
  setSubscriberMock.mockReset().mockResolvedValue('Case insurance updated successfully')
  getVisitMock.mockReset().mockResolvedValue({
    id: 41,
    caseId: 'p14-case',
    treatingProviderId: 6,
    chargeLines: [{ id: 70, procedureCodeId: 97033 }],
  })

  exceptions = structuredClone(ALL)
  listMock.mockReset().mockImplementation((filter = {}) => Promise.resolve(structuredClone(matching(filter))))
  groupsMock.mockReset().mockImplementation((filter = {}) => {
    const rows = matching(filter)
    const types = [...new Set(rows.map((item) => item.type))].map((type) => {
      const ofType = rows.filter((item) => item.type === type)
      return {
        type,
        total: ofType.length,
        reasons: [...new Set(ofType.map((item) => item.reason))].map((reason) => ({
          reason,
          total: ofType.filter((item) => item.reason === reason).length,
        })),
      }
    })
    return Promise.resolve({ total: rows.length, types })
  })
  // By default the fix worked: the re-check clears the exception.
  reprocessMock.mockReset().mockImplementation((id) => {
    exceptions = exceptions.filter((item) => item.id !== id)
    return Promise.resolve({ message: 'Fixed: the exception is cleared', stillThere: false })
  })
  deleteMock.mockReset().mockImplementation((id) => {
    exceptions = exceptions.filter((item) => item.id !== id)
    return Promise.resolve('Billing exception removed')
  })
  scanMock.mockReset().mockResolvedValue({
    message: 'Practice re-checked for billing exceptions',
    counts: { patients: 3, cases: 3, visits: 1, exceptions: 8 },
  })
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
const dataRows = async () =>
  within(await table())
    .getAllByRole('row')
    .slice(1)
const rowOf = async (text: string) =>
  (await within(await table()).findByText(text, undefined, { timeout: 5000 })).closest('tr') as HTMLElement
const resolve = async (trigger: string) => {
  const row = await rowOf(trigger)
  await userEvent.click(
    within(row).getByRole('button', { name: new RegExp(`^Resolve ${trigger.replace(/[$()/.]/g, '\\$&')}`) }),
  )
  return screen.findByRole('dialog')
}
const cleared = (label: string) =>
  expect(toasts()).toEqual([
    expect.objectContaining({
      tone: 'success',
      title: label,
      description: 'Fixed: the exception is cleared',
    }),
  ])

describe('Exceptions — the queue', () => {
  it('lists the server’s exceptions: by type, then reason, with its counts', async () => {
    renderAt('/exceptions')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Exceptions' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    // The type as tabs — each a URL — with the server's counts.
    const types = await screen.findByRole('navigation', { name: 'Exception types' })
    await waitFor(() =>
      expect(
        within(types)
          .getAllByRole('link')
          .map((tab) => tab.textContent),
      ).toEqual(['All 8', 'Patient 3', 'Case 2', 'Charge 3']),
    )
    expect(within(types).getByRole('link', { name: 'All 8' })).toHaveAttribute('aria-current', 'page')
    // Reasons belong to a type: none until one is chosen.
    expect(screen.queryByRole('radiogroup', { name: 'Reason' })).not.toBeInTheDocument()
    expect(await dataRows()).toHaveLength(8)
    // The reason, the server's message, and the record it sits on.
    const fee = await rowOf('Charged at $0.00')
    expect(fee).toHaveTextContent('Line 97033 is charged at $0.00.')
    expect(fee).toHaveTextContent('Reilly, Thomas')
    expect(fee).toHaveTextContent('Visit · DOS 09/14/2026')
    expect(await rowOf('Invalid referring physician NPI')).toHaveTextContent('Case Chronic low back')
    expect(await rowOf('Placeholder phone number')).toHaveTextContent('Patient record')
    // A reason with no fix form opens the record where it is fixed.
    expect(
      within(await rowOf('No primary insurance')).getByRole('link', { name: /^Open the case/ }),
    ).toHaveAttribute('href', '/patients/p10?case=p10-case')
    expect(
      within(await rowOf('No diagnosis codes')).getByRole('link', { name: /^Open the visit/ }),
    ).toHaveAttribute('href', '/visits/41')
    // Nothing the server does not have.
    expect(screen.queryByRole('navigation', { name: 'Exception lists' })).not.toBeInTheDocument()
    expect(screen.queryByText(/owner|due|resolved/i)).not.toBeInTheDocument()
  }, 15_000)

  it('asks the server for one type, then one reason — kept in the URL', async () => {
    const router = renderAt('/exceptions')
    const types = await screen.findByRole('navigation', { name: 'Exception types' }, { timeout: 5000 })
    await userEvent.click(await within(types).findByRole('link', { name: 'Patient 3' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ type: 'patient' }))
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ type: 'patient' }, expect.anything()))
    await waitFor(async () => expect(await dataRows()).toHaveLength(3))
    const reasons = await screen.findByRole('radiogroup', { name: 'Reason' })
    expect(
      within(reasons)
        .getAllByRole('radio')
        .map((chip) => chip.textContent),
    ).toEqual([
      'All reasons 3',
      'Placeholder phone number 1',
      'ZIP code does not match the state 1',
      'Too long for the claim form 1',
    ])
    expect(within(reasons).getByRole('radio', { name: 'All reasons 3' })).toBeChecked()
    await userEvent.click(within(reasons).getByRole('radio', { name: /^ZIP code/ }))
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ type: 'patient', reason: 'zip_state_mismatch' }),
    )
    await waitFor(async () => expect(await dataRows()).toHaveLength(1))
    // The type's tab stays current under a reason.
    expect(within(types).getByRole('link', { name: 'Patient 3' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(within(reasons).getByRole('radio', { name: 'All reasons 3' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ type: 'patient' }))
    await userEvent.click(within(types).getByRole('link', { name: 'All 8' }))
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    await waitFor(async () => expect(await dataRows()).toHaveLength(8))
  }, 15_000)

  it('asks the server for one practice’s (?practice=)', async () => {
    exceptions = [PHONE, { ...ADDRESS, practiceId: 2 }]
    renderAt('/exceptions?practice=2')
    await waitFor(async () => expect(await dataRows()).toHaveLength(1))
    expect((await dataRows())[0]).toHaveTextContent('ZIP code does not match the state')
    expect(listMock).toHaveBeenCalledWith({ practiceId: 2 }, expect.anything())
    expect(groupsMock).toHaveBeenCalledWith({ practiceId: 2 }, expect.anything())
  })

  it('says so when there is nothing to show', async () => {
    exceptions = []
    renderAt('/exceptions')
    expect(await screen.findByText('No billing exceptions', undefined, { timeout: 5000 })).toBeVisible()
  })

  it('re-checks a row: the server’s answer, cleared or still there', async () => {
    reprocessMock.mockResolvedValueOnce({
      message: 'The problem is still there; fix the data and reprocess again',
      stillThere: true,
    })
    renderAt('/exceptions')
    const row = await rowOf('Invalid treating provider NPI')
    await userEvent.click(
      within(row).getByRole('button', { name: /^Re-check Invalid treating provider NPI/ }),
    )
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({
          tone: 'warning',
          title: 'The problem is still there; fix the data and reprocess again',
          description: 'The treating provider’s NPI is missing.',
        }),
      ]),
    )
    expect(reprocessMock).toHaveBeenCalledWith(6)
    useToastStore.getState().clear()
    await userEvent.click(
      within(row).getByRole('button', { name: /^Re-check Invalid treating provider NPI/ }),
    )
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({ tone: 'success', title: 'Fixed: the exception is cleared' }),
      ]),
    )
    await waitFor(async () => expect(await dataRows()).toHaveLength(7))
  }, 15_000)

  it('deletes an exception after asking, in the server’s words', async () => {
    renderAt('/exceptions')
    const row = await rowOf('No diagnosis codes')
    await userEvent.click(within(row).getByRole('button', { name: /^Delete No diagnosis codes/ }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this exception?' })
    expect(
      within(confirm).getByText(
        'It is taken off the list. It comes back when its record is saved, or its visit released, while the problem is still there.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete exception' }))
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({ tone: 'success', title: 'Billing exception removed' }),
      ]),
    )
    expect(deleteMock).toHaveBeenCalledWith(8)
    await waitFor(async () => expect(await dataRows()).toHaveLength(7))
  }, 15_000)

  it('scans a practice: what the server checked and found', async () => {
    renderAt('/exceptions?practice=2')
    await screen.findByRole('heading', { level: 1, name: 'Exceptions' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Scan practice' }))
    const dialog = screen.getByRole('dialog', { name: 'Scan for billing exceptions' })
    // The practice in view is the one offered.
    expect(within(dialog).getByRole('combobox', { name: /practice/i })).toHaveTextContent('North Shore Rehab')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Scan practice' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(scanMock).toHaveBeenCalledWith(2)
    expect(toasts()).toEqual([
      expect.objectContaining({
        tone: 'success',
        title: 'Practice re-checked for billing exceptions',
        description: '3 patients, 3 cases and 1 visit checked: 8 exceptions.',
      }),
    ])
  }, 15_000)
})

describe('Exceptions — resolving', () => {
  it('fixes a placeholder phone: refuses another placeholder, then saves and has it re-checked', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Placeholder phone number')
    expect(within(dialog).getByRole('heading', { name: 'Fix phone — Victor Moreau' })).toBeInTheDocument()
    expect(within(dialog).getByText('Patient · Placeholder phone number.')).toBeInTheDocument()
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
    // The patient record itself was corrected on the server — the phones alone.
    expect(updatePatientFieldsMock).toHaveBeenCalledWith('p10', {
      phone_cell: '7185550177',
      phone_home: null,
    })
    // Then the server re-checked it, and said so.
    await waitFor(() => cleared('Patient updated'))
    expect(reprocessMock).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Placeholder phone number')).not.toBeInTheDocument())
  }, 20_000)

  it('says when the problem is still there after a fix — and when the save had already cleared it', async () => {
    reprocessMock
      .mockResolvedValueOnce({
        message: 'The problem is still there; fix the data and reprocess again',
        stillThere: true,
      })
      .mockRejectedValueOnce(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
    renderAt('/exceptions')
    let dialog = await resolve('Placeholder phone number')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /cell phone/i }), '718-555-0177')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({
          tone: 'warning',
          title: 'Patient updated',
          description: 'The problem is still there; fix the data and reprocess again',
        }),
      ]),
    )
    useToastStore.getState().clear()
    dialog = await resolve('Placeholder phone number')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /cell phone/i }), '718-555-0177')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({
          tone: 'success',
          title: 'Patient updated',
          description: 'The exception is cleared.',
        }),
      ]),
    )
  }, 20_000)

  it('fixes an address: the ZIP code must belong to the state', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('ZIP code does not match the state')
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
    await waitFor(() => cleared('Patient updated'))
  }, 15_000)

  it('fixes a name that is too long, with the shortened version offered', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Too long for the claim form')
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
    const dialog = await resolve('Invalid referring physician NPI')
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
    // A physician's save checks nothing by itself: the re-check does.
    await waitFor(() => cleared('Referring physician fixed'))
  }, 15_000)

  it('or gives the case another referring physician', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Invalid referring physician NPI')
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

  it('adds the treating provider’s NPI — and keeps the dialog open if the save fails', async () => {
    updateProviderMock.mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'offline' }))
    renderAt('/exceptions')
    const dialog = await resolve('Invalid treating provider NPI')
    // The visit's treating provider, read with the visit.
    expect(
      await within(dialog).findByRole('heading', { name: 'Add rendering NPI — Caleb Wright, PT' }),
    ).toBeInTheDocument()
    expect(getVisitMock).toHaveBeenCalledWith(41, expect.anything())
    await userEvent.type(within(dialog).getByRole('textbox', { name: /individual npi/i }), '1528461903')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(
      await within(dialog).findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeVisible()
    expect(reprocessMock).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // The NPI alone: the rest of the provider stays as it is.
    expect(updateProviderMock).toHaveBeenLastCalledWith(6, '1528461903')
    await waitFor(() => cleared('Provider NPI saved'))
  }, 15_000)

  it('prices a code charged at $0.00: a default fee, the payer’s rate, or both', async () => {
    renderAt('/exceptions')
    const dialog = await resolve('Charged at $0.00')
    expect(
      await within(dialog).findByRole('heading', { name: 'Price 97033 — Iontophoresis' }),
    ).toBeInTheDocument()
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
    await waitFor(() => cleared('97033 priced'))

    // The default fee alone, on the server's code.
    expect(setDefaultFeeMock).toHaveBeenCalledWith(97033, 18.5)
    // The payer's row — the case's primary insurance — for this year, on the server.
    const year = new Date().getFullYear()
    expect(createFeeRowMock).toHaveBeenCalledWith(3, {
      procedureCodeId: '97033',
      billed: '22',
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    })
  }, 20_000)

  it('completes a missing case field, and a subscriber’s details', async () => {
    exceptions = [
      exception(11, {
        type: 'case',
        reason: 'missing_injury_date',
        detail: 'The injury date is missing.',
        caseId: 'p10-case',
      }),
      exception(12, {
        type: 'case',
        reason: 'incomplete_subscriber',
        detail: 'The subscriber has no date of birth.',
        caseId: 'p10-case',
      }),
    ]
    renderAt('/exceptions')
    let dialog = await resolve('No injury date')
    expect(
      within(dialog).getByRole('heading', { name: 'Complete case fields — Plantar fasciitis' }),
    ).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    expect(await within(dialog).findByText('Enter the injury or onset date.')).toBeVisible()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /injury \/ onset date/i }), '09/01/2026')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save and re-check' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => cleared('Case updated'))
    // What is filled in — the date, and the physician the case already had — and nothing else.
    expect(updateCaseFieldsMock).toHaveBeenCalledWith('p10-case', {
      injury_date: '2026-09-01',
      referring_physician_id: 1,
    })

    dialog = await resolve('Incomplete subscriber')
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
