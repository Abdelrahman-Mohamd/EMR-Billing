import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { todayIso } from '@/lib/utils/dates'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Practice } from '@/features/admin-practices'
import type { Provider } from '@/features/admin-providers'
import {
  createVisit as createVisitApi,
  deleteVisit as deleteVisitApi,
  getVisit,
  listVisits,
  releaseVisit as releaseVisitApi,
  updateVisit as updateVisitApi,
} from '../api/visits-api'
import { addChargeLine, deleteChargeLine, updateChargeLine } from '../api/charge-lines-api'
import type { ChargeLine, Visit } from '../schemas/visit'

// Only the integration points are faked: this feature's api functions, the
// claims api, and the lists the pickers and names read — patients, their
// cases, coverage and authorizations, procedure codes, practices and
// providers (faked by path — never imported, as lint requires).
const seed = vi.hoisted(() => {
  const patient = (id: string, firstName: string, lastName: string) => ({
    id,
    practiceId: 1,
    billingId: Number(id),
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
  })
  // A case as the server sends it, parsed.
  const patientCase = (
    id: string,
    patientId: string,
    name: string,
    diagnoses: Array<{ id: string; code: string; description: string }>,
  ) => ({
    id,
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
    diagnoses,
  })
  // The case's primary insurance as the server sends it, parsed.
  const coverage = (id: string, caseId: string) => ({
    id,
    caseId,
    insuranceId: 3,
    insuranceLabel: '1003 – Aetna',
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
  })
  const code = (value: string, description: string, extra: Record<string, unknown> = {}) => ({
    id: Number(value),
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
  SEED_PATIENTS: [seed.patient('11', 'Nadia', 'Okonkwo')],
  SEED_CASES: [
    seed.patientCase('20', '11', 'R shoulder 2026', [
      {
        id: '1',
        code: 'M75.101',
        description: 'Unspecified rotator cuff tear of right shoulder, not traumatic',
      },
      { id: '2', code: 'M25.511', description: 'Pain in right shoulder' },
    ]),
  ],
  SEED_COVERAGES: [seed.coverage('30', '20')],
  SEED_CODES: [
    seed.code('97110', 'Therapeutic exercise'),
    seed.code('97140', 'Manual therapy techniques', { modifierOverride: true, modifiers: ['GP', '59'] }),
    seed.code('97530', 'Therapeutic activities'),
  ],
}))
vi.mock('@/features/patients/api/patients-api', () => ({
  listPatients: () => Promise.resolve(SEED_PATIENTS),
  getPatient: (id: string) => Promise.resolve(SEED_PATIENTS.find((item) => item.id === id)),
}))
vi.mock('@/features/patients/api/patient-cases-api', () => ({
  listPatientCases: () => Promise.resolve(SEED_CASES),
}))
vi.mock('@/features/patients/api/case-insurances-api', () => ({
  listCaseInsurances: () => Promise.resolve(SEED_COVERAGES),
}))
vi.mock('@/features/patients/api/authorizations-api', () => ({
  listAuthorizations: () => Promise.resolve([]),
}))
vi.mock('@/features/admin-procedure-codes/api/procedure-codes-api', () => ({
  listProcedureCodes: () => Promise.resolve(SEED_CODES),
}))

vi.mock('../api/visits-api', () => ({
  listVisits: vi.fn(),
  getVisit: vi.fn(),
  createVisit: vi.fn(),
  updateVisit: vi.fn(),
  deleteVisit: vi.fn(),
  releaseVisit: vi.fn(),
}))
vi.mock('../api/charge-lines-api', () => ({
  addChargeLine: vi.fn(),
  updateChargeLine: vi.fn(),
  deleteChargeLine: vi.fn(),
}))
const listClaimsMock = vi.hoisted(() => vi.fn())
const createClaimMock = vi.hoisted(() => vi.fn())
const updateClaimMock = vi.hoisted(() => vi.fn())
const deleteClaimMock = vi.hoisted(() => vi.fn())
const scrubClaimMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/claims/api/claims-api', () => ({
  listClaims: listClaimsMock,
  createClaim: createClaimMock,
  updateClaim: updateClaimMock,
  deleteClaim: deleteClaimMock,
  scrubClaim: scrubClaimMock,
}))
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  // Every location, as the list has them: the same fixtures.
  listLocations: async () =>
    (await practicesMock()).flatMap((practice) =>
      practice.locations.map(({ id, practiceId, code, name, isActive }) => ({
        id,
        practiceId,
        code,
        name,
        isActive,
      })),
    ),
  getPractice: async (id: number) => {
    const found = (await practicesMock()).find((practice) => practice.id === id)
    if (found === undefined) throw new Error(`No practice ${id} in this test`)
    return found
  },
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
const providersMock = vi.hoisted(() => vi.fn<() => Promise<Provider[]>>())
vi.mock('@/features/admin-providers/api/providers-api', () => ({
  listProviders: providersMock,
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
}))

const location = (id: number, name: string, isActive = true) => ({
  id,
  practiceId: 1,
  code: `L${id}`,
  name,
  npi: '1609847312',
  address: { line1: '1 Main Street', city: 'Brooklyn', state: 'NY', zip: '11209' },
  placeOfService: '11',
  isActive,
})
const harborline = {
  id: 1,
  organizationId: null,
  code: 'P1',
  name: 'Harborline Physical Therapy',
  npi: '1609847312',
  taxId: '84-2217765',
  taxonomyCode: '225100000X',
  address: { line1: '1 Main Street', city: 'Brooklyn', state: 'NY', zip: '11209' },
  isActive: true,
  locations: [location(1, 'Bay Ridge'), location(2, 'Park Slope'), location(3, 'Old Annex', false)],
} as unknown as Practice

const provider = (id: number, firstName: string, lastName: string, credential: string) =>
  ({
    id,
    practiceId: 1,
    code: String(300 + id),
    firstName,
    lastName,
    credential,
    specialty: 'PHYSICAL THERAPIST',
    type: 'billing',
    typeLabel: 'Billing',
    npi: '1356482917',
    taxonomyCode: '225100000X',
    stateLicense: '',
    isActive: true,
  }) as unknown as Provider

const line = (
  id: number,
  procedureCodeId: number,
  units: number,
  modifiers: string[],
  diagnosisPointers: number[],
  amount: string,
): ChargeLine => ({
  id,
  visitId: 7,
  procedureCodeId,
  procedureCode: '',
  procedureDescription: '',
  units,
  amount,
  modifiers,
  diagnosisPointers,
  placeOfService: '11',
  notes: '',
  codingRuleId: null,
  originalProcedureCodeId: null,
})

/** A visit as the server lists it, parsed. */
const VISIT: Visit = {
  id: 7,
  caseId: '20',
  caseName: 'R shoulder 2026',
  patientId: '11',
  patientFirstName: 'Nadia',
  patientLastName: 'Okonkwo',
  dateOfService: '2026-09-14',
  status: 'review',
  pendReason: '',
  source: 'manual',
  // The case's diagnoses when the visit was made: its pointers name these.
  diagnosisCodes: ['M75.101', 'M25.511'],
  locationId: 1,
  locationName: 'Bay Ridge',
  placeOfService: '11',
  billingProviderId: 1,
  billingProvider: null,
  treatingProviderId: 2,
  treatingProvider: { name: 'Marcus Delaney', npi: '1356482917' },
  authorizationId: null,
  authorization: null,
  totalAmount: '105.00',
  releasedAt: '',
  chargeLines: [
    line(71, 97110, 2, ['GP'], [1], '70.00'),
    { ...line(72, 97140, 1, ['GP', '59'], [2, 1], '35.00'), notes: 'Patient tolerated well' },
  ],
}

let visits: Visit[]

/** A claim as the server lists it, parsed: the whole visit 7, billed to the case's primary. */
const CLAIM = {
  id: 1,
  visitId: 7,
  coverageId: '30',
  format: '837P',
  status: 'scrubbed',
  scrubErrors: [] as string[],
  allowedStatusChanges: ['sent'],
  totalAmount: '105.00',
  sentDate: '',
  clearinghouseRef: '',
  controlNumber: 'C1',
  payerClaimNumber: '',
  clearinghouseBatchId: '',
  clearinghouseStatus: '',
  insuranceName: '1003 – Aetna',
  rankLabel: 'Primary',
  memberId: 'W0001',
  patientId: '11',
  patientFirstName: 'Nadia',
  patientLastName: 'Okonkwo',
  dateOfService: '2026-09-14',
}
let claims: Array<typeof CLAIM>

/** A visit read on its own: with its billing provider and each line's code and description. */
const detailOf = (visit: Visit): Visit => ({
  ...visit,
  billingProvider: { name: 'Aisha Rahman', npi: '1356482917' },
  chargeLines: visit.chargeLines.map((item) => {
    const found = SEED_CODES.find((code) => code.id === item.procedureCodeId)
    return { ...item, procedureCode: found?.code ?? '', procedureDescription: found?.description ?? '' }
  }),
})

beforeEach(() => {
  visits = [VISIT]
  // As the server filters them: a case's when asked.
  vi.mocked(listVisits)
    .mockReset()
    .mockImplementation((filter = {}) =>
      Promise.resolve(
        structuredClone(
          visits.filter((visit) => filter.caseId === undefined || visit.caseId === filter.caseId),
        ),
      ),
    )
  vi.mocked(getVisit)
    .mockReset()
    .mockImplementation((id) => {
      const found = visits.find((visit) => visit.id === id)
      return found === undefined
        ? Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
        : Promise.resolve(detailOf(structuredClone(found)))
    })
  vi.mocked(createVisitApi)
    .mockReset()
    .mockImplementation((payload) => {
      visits = [
        {
          ...VISIT,
          id: 8,
          dateOfService: payload.date_of_service,
          locationId: payload.location_id,
          billingProviderId: payload.billing_provider_id,
          treatingProviderId: payload.treating_provider_id,
          chargeLines: payload.charge_lines.map((item, index) =>
            line(
              80 + index,
              item.procedure_code_id,
              item.units,
              item.modifiers ?? [],
              item.diagnosis_pointers ?? [1],
              '35.00',
            ),
          ),
        },
        ...visits,
      ]
      return Promise.resolve('Visit created successfully')
    })
  vi.mocked(updateVisitApi)
    .mockReset()
    .mockImplementation((id, payload) => {
      visits = visits.map((visit) =>
        visit.id === id
          ? {
              ...visit,
              dateOfService: payload.date_of_service,
              locationId: payload.location_id,
              locationName: payload.location_id === 2 ? 'Park Slope' : 'Bay Ridge',
            }
          : visit,
      )
      return Promise.resolve('Visit updated successfully')
    })
  vi.mocked(deleteVisitApi)
    .mockReset()
    .mockImplementation((id) => {
      visits = visits.filter((visit) => visit.id !== id)
      return Promise.resolve('Visit deleted successfully')
    })
  vi.mocked(releaseVisitApi)
    .mockReset()
    .mockImplementation((id) => {
      visits = visits.map((visit) =>
        visit.id === id ? { ...visit, status: 'released', releasedAt: '2026-10-09T16:27:04.000000Z' } : visit,
      )
      const released = visits.find((visit) => visit.id === id) ?? VISIT
      return Promise.resolve({ message: 'Visit released for claiming', visit: released })
    })
  const onVisit = (id: number, change: (lines: ChargeLine[]) => ChargeLine[]) => {
    visits = visits.map((visit) =>
      visit.id === id ? { ...visit, chargeLines: change(visit.chargeLines) } : visit,
    )
  }
  vi.mocked(addChargeLine)
    .mockReset()
    .mockImplementation((payload) => {
      onVisit(payload.visit_id, (lines) => [
        ...lines,
        line(
          99,
          payload.procedure_code_id,
          payload.units,
          payload.modifiers ?? [],
          payload.diagnosis_pointers ?? [1],
          '35.00',
        ),
      ])
      return Promise.resolve('Charge line created successfully')
    })
  vi.mocked(updateChargeLine)
    .mockReset()
    .mockImplementation((id, payload) => {
      onVisit(7, (lines) =>
        lines.map((item) =>
          item.id === id
            ? {
                ...item,
                units: payload.units,
                modifiers: payload.modifiers ?? [],
                notes: payload.notes ?? '',
              }
            : item,
        ),
      )
      return Promise.resolve('Charge line updated successfully')
    })
  vi.mocked(deleteChargeLine)
    .mockReset()
    .mockImplementation((id) => {
      onVisit(7, (lines) => lines.filter((item) => item.id !== id))
      return Promise.resolve('Charge line deleted successfully')
    })
  claims = [CLAIM]
  listClaimsMock
    .mockReset()
    .mockImplementation((filter: { visitId?: number } = {}) =>
      Promise.resolve(
        structuredClone(
          claims.filter((claim) => filter.visitId === undefined || claim.visitId === filter.visitId),
        ),
      ),
    )
  createClaimMock
    .mockReset()
    .mockImplementation((payload: { visit_id: number; case_insurance_id: number }) => {
      claims = [
        ...claims,
        { ...CLAIM, id: 2, visitId: payload.visit_id, coverageId: String(payload.case_insurance_id) },
      ]
      return Promise.resolve('Claim created and scrubbed')
    })
  updateClaimMock.mockReset().mockImplementation((id: number, payload: { status?: string }) => {
    claims = claims.map((claim) =>
      claim.id === id && payload.status !== undefined
        ? { ...claim, status: payload.status, allowedStatusChanges: [], sentDate: '2026-10-09' }
        : claim,
    )
    return Promise.resolve('Claim updated successfully')
  })
  // A re-scrub that still finds the data wrong: the claim fails, saying why.
  scrubClaimMock.mockReset().mockImplementation((id: number) => {
    const errors = [
      'The practice billing address needs a 9-digit ZIP+4 for an electronic claim (2010AA-N403).',
    ]
    claims = claims.map((claim) =>
      claim.id === id ? { ...claim, status: 'failed', scrubErrors: errors } : claim,
    )
    return Promise.resolve({ message: 'Claim scrubbed', claim: claims.find((claim) => claim.id === id) })
  })
  deleteClaimMock.mockReset().mockImplementation((id: number) => {
    claims = claims.filter((claim) => claim.id !== id)
    return Promise.resolve('Claim deleted successfully')
  })
  practicesMock.mockReset().mockResolvedValue([harborline])
  providersMock
    .mockReset()
    .mockResolvedValue([provider(1, 'Aisha', 'Rahman', 'PT, DPT'), provider(2, 'Marcus', 'Delaney', 'PT')])
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
/** New visit, from the Visits list. */
async function openFromList() {
  const buttons = await screen.findAllByRole('button', { name: 'New visit' }, { timeout: 5000 })
  await userEvent.click(buttons[0] as HTMLElement)
  return screen.findByRole('dialog', { name: 'New visit' })
}
/** New visit, from the case's Visits card on the patient chart: the case is already chosen. */
async function openFromChart() {
  const card = await screen.findByRole('region', { name: 'Visits' }, { timeout: 5000 })
  await userEvent.click(within(card).getByRole('button', { name: 'New visit' }))
  return screen.findByRole('dialog', { name: 'New visit' })
}
const choose = async (scope: HTMLElement, label: RegExp, option: string | RegExp) => {
  await userEvent.click(within(scope).getByRole('combobox', { name: label }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}
const openVisit = async () => {
  renderAt('/visits/7')
  return screen.findByRole('heading', { level: 1, name: 'Nadia Okonkwo · 09/14/2026' }, { timeout: 5000 })
}

describe('Visits — the list', () => {
  it('lists each visit as the server does: patient, case, date, location, provider, lines, total and status', async () => {
    renderAt('/visits')
    const table = await screen.findByRole('table', { name: 'Visits' }, { timeout: 5000 })
    const row = (await within(table).findByText('Okonkwo, Nadia', undefined, { timeout: 5000 })).closest(
      'tr',
    ) as HTMLElement
    expect(row).toHaveTextContent('R shoulder 2026')
    expect(row).toHaveTextContent('09/14/2026')
    expect(row).toHaveTextContent('Bay Ridge')
    expect(row).toHaveTextContent('Marcus Delaney')
    // The lines by their codes, looked up by the codes' ids.
    expect(row).toHaveTextContent('97110 × 2 · 97140')
    expect(row).toHaveTextContent('$105.00')
    expect(row).toHaveTextContent('In review')
    // The row opens the visit.
    expect(within(row).getByRole('link', { name: /Okonkwo, Nadia/ })).toHaveAttribute('href', '/visits/7')
  }, 10_000)

  it('says so when there are none, and offers to record one', async () => {
    visits = []
    renderAt('/visits')
    expect(await screen.findByText('No visits yet', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'New visit' }).length).toBeGreaterThan(0)
  })
})

describe('Visits — a new visit', () => {
  it('asks for the case, providers, location and each line’s code', async () => {
    renderAt('/visits')
    const form = await openFromList()
    await userEvent.click(within(form).getByRole('button', { name: 'Create visit' }))
    expect(await within(form).findByText('Select a case.')).toBeVisible()
    expect(within(form).getByText('Select a location.')).toBeVisible()
    expect(within(form).getByText('Select the billing provider.')).toBeVisible()
    expect(within(form).getByText('Select the treating provider.')).toBeVisible()
    expect(within(form).getByText('Select a procedure code.')).toBeVisible()
    // Until a case is chosen there is nothing to pick from.
    expect(within(form).getByRole('combobox', { name: /^location/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(createVisitApi).not.toHaveBeenCalled()
  }, 10_000)

  it('records a visit on a case with two charge lines, as the contract’s payload carries them', async () => {
    const router = renderAt('/patients/11')
    const form = await openFromChart()
    await waitFor(() =>
      expect(within(form).getByRole('combobox', { name: /^location/i })).not.toHaveAttribute('aria-disabled'),
    )
    // Only the practice's active locations.
    await userEvent.click(within(form).getByRole('combobox', { name: /^location/i }))
    expect(screen.queryByRole('option', { name: 'Old Annex' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'Park Slope' }))
    await choose(form, /^billing provider/i, 'Aisha Rahman, PT, DPT')
    await choose(form, /^treating provider/i, 'Marcus Delaney, PT')

    const first = within(form).getByRole('group', { name: 'Charge line 1' })
    await choose(first, /^procedure code/i, /^97110/)
    await userEvent.clear(within(first).getByRole('textbox', { name: /^units/i }))
    await userEvent.type(within(first).getByRole('textbox', { name: /^units/i }), '2')

    await userEvent.click(within(form).getByRole('button', { name: 'Add charge line' }))
    const second = within(form).getByRole('group', { name: 'Charge line 2' })
    // A code whose modifier override is on fills in its modifiers.
    await choose(second, /^procedure code/i, /^97140/)
    expect(within(second).getByRole('textbox', { name: /^modifiers/i })).toHaveValue('GP, 59')
    // Pointers in the order chosen: the second diagnosis first.
    await userEvent.click(within(second).getByRole('combobox', { name: /^diagnosis pointers/i }))
    await userEvent.click(await screen.findByRole('option', { name: /^2 · M25\.511/ }))
    await userEvent.click(screen.getByRole('option', { name: /^1 · M75\.101/ }))
    await userEvent.keyboard('{Escape}')
    // Its own place of service, and a note.
    await userEvent.type(within(second).getByRole('textbox', { name: /^place of service/i }), '22')
    await userEvent.type(within(second).getByRole('textbox', { name: /^notes/i }), 'Left shoulder too')

    await userEvent.click(within(form).getByRole('button', { name: 'Create visit' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createVisitApi).toHaveBeenCalledWith({
      case_id: 20,
      // New visits start on today's date.
      date_of_service: todayIso(),
      location_id: 2,
      billing_provider_id: 1,
      treating_provider_id: 2,
      authorization_id: null,
      // The case's diagnoses, as the visit starts with them.
      diagnosis_codes: ['M75.101', 'M25.511'],
      charge_lines: [
        { procedure_code_id: 97110, units: 2 },
        {
          procedure_code_id: 97140,
          units: 1,
          modifiers: ['GP', '59'],
          diagnosis_pointers: [2, 1],
          place_of_service: '22',
          notes: 'Left shoulder too',
        },
      ],
    })
    // The server's message; the chart stays, and its visits are read again.
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Visit created successfully' })])
    expect(router.state.location.pathname).toBe('/patients/11')
    const card = screen.getByRole('region', { name: 'Visits' })
    expect(await within(card).findAllByRole('link', { name: /\d{2}\/\d{2}\/\d{4}/ })).toHaveLength(2)
  }, 30_000)

  it('puts the server’s refusals on the fields, and keeps the form', async () => {
    vi.mocked(createVisitApi).mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This case already has a visit on that date.',
        serverMessage: 'This case already has a visit on that date.',
        status: 422,
        // As the api hands them over: renamed to the form's fields.
        fieldErrors: [
          { path: 'dateOfService', message: 'This case already has a visit on that date.' },
          { path: 'lines.0.procedureCode', message: 'Each charge line needs an active procedure code.' },
        ],
      }),
    )
    renderAt('/patients/11')
    const form = await openFromChart()
    await waitFor(() =>
      expect(within(form).getByRole('combobox', { name: /^location/i })).not.toHaveAttribute('aria-disabled'),
    )
    await userEvent.click(within(form).getByRole('button', { name: 'Add charge line' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Remove charge line 2' }))
    expect(within(form).queryByRole('group', { name: 'Charge line 2' })).not.toBeInTheDocument()
    // The last line cannot be removed.
    expect(within(form).queryByRole('button', { name: 'Remove charge line 1' })).not.toBeInTheDocument()

    await choose(form, /^location/i, 'Bay Ridge')
    await choose(form, /^billing provider/i, 'Aisha Rahman, PT, DPT')
    await choose(form, /^treating provider/i, 'Aisha Rahman, PT, DPT')
    await choose(within(form).getByRole('group', { name: 'Charge line 1' }), /^procedure code/i, /^97110/)
    await userEvent.click(within(form).getByRole('button', { name: 'Create visit' }))
    expect(await within(form).findByText('This case already has a visit on that date.')).toBeVisible()
    expect(within(form).getByText('Each charge line needs an active procedure code.')).toBeVisible()
    // The dialog stays open with what was entered.
    expect(screen.getByRole('dialog', { name: 'New visit' })).toBeInTheDocument()
  }, 30_000)
})

describe('Visits — one visit', () => {
  it('shows the visit as the server reads it: details, lines with amounts, and the diagnoses each points to', async () => {
    await openVisit()
    const details = screen.getByRole('region', { name: 'Visit details' })
    expect(details).toHaveTextContent('R shoulder 2026')
    expect(details).toHaveTextContent('Bay Ridge')
    expect(details).toHaveTextContent('Place of service 11')
    expect(details).toHaveTextContent('Aisha Rahman')
    expect(details).toHaveTextContent('Marcus Delaney')
    expect(details).toHaveTextContent('$105.00')
    expect(screen.getByText('In review')).toBeInTheDocument()
    const lines = screen.getByRole('table', { name: /^Charge lines of the visit/ })
    const manual = within(lines).getByText('97140').closest('tr') as HTMLElement
    expect(manual).toHaveTextContent('Manual therapy techniques')
    expect(manual).toHaveTextContent('GP, 59')
    // The pointers name the visit's own copy of the case's diagnoses.
    expect(manual).toHaveTextContent('2 · M25.511, 1 · M75.101')
    expect(manual).toHaveTextContent('$35.00')
    expect(manual).toHaveTextContent('Note: Patient tolerated well')
    // Back to the case it belongs to.
    expect(screen.getByRole('link', { name: 'Open chart' })).toHaveAttribute(
      'href',
      '/patients/11?case=20#case',
    )
  }, 10_000)

  it('releases the visit; once released it offers no change', async () => {
    await openVisit()
    await userEvent.click(screen.getByRole('button', { name: 'Release visit' }))
    await waitFor(() =>
      expect(toasts()).toEqual([expect.objectContaining({ title: 'Visit released for claiming' })]),
    )
    expect(releaseVisitApi).toHaveBeenCalledWith(7)
    expect(await screen.findByText('Released', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Release visit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit visit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete visit' })).not.toBeInTheDocument()
    // Its lines are frozen too.
    expect(screen.queryByRole('button', { name: 'Add charge line' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit charge line 2 (97140)' })).not.toBeInTheDocument()
  }, 10_000)

  it('says why when the server pends it instead', async () => {
    const reason =
      'Aetna requires authorization: no authorization in force on 2026-09-14 has enough remaining.'
    vi.mocked(releaseVisitApi).mockImplementationOnce((id) => {
      visits = visits.map((visit) =>
        visit.id === id ? { ...visit, status: 'pended', pendReason: reason } : visit,
      )
      return Promise.resolve({
        message: `Visit pended: ${reason}`,
        visit: { ...VISIT, status: 'pended', pendReason: reason },
      })
    })
    await openVisit()
    await userEvent.click(screen.getByRole('button', { name: 'Release visit' }))
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({ tone: 'warning', title: 'The visit was pended', description: reason }),
      ]),
    )
    // The reason stays on the page, beside the toast; it can be fixed and released again.
    await waitFor(() => expect(screen.getAllByText(reason)).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Release visit' })).toBeInTheDocument()
  }, 10_000)

  it('edits the visit’s own fields, with the server’s message', async () => {
    await openVisit()
    await userEvent.click(screen.getByRole('button', { name: 'Edit visit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit visit' })
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: /^location/i })).toHaveTextContent('Bay Ridge'),
    )
    await choose(dialog, /^location/i, 'Park Slope')
    // The visit's own diagnoses: one taken off.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^diagnoses/i }))
    await userEvent.click(screen.getByRole('option', { name: /M25\.511/ }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save visit' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateVisitApi).toHaveBeenCalledWith(7, {
      date_of_service: '2026-09-14',
      location_id: 2,
      billing_provider_id: 1,
      treating_provider_id: 2,
      authorization_id: null,
      diagnosis_codes: ['M75.101'],
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Visit updated successfully' })])
    expect(
      await within(screen.getByRole('region', { name: 'Visit details' })).findByText('Park Slope'),
    ).toBeVisible()
  }, 20_000)

  it('deletes the visit after asking, and goes back to the list', async () => {
    await openVisit()
    await userEvent.click(screen.getByRole('button', { name: 'Delete visit' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this visit?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete visit' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Visits' }, { timeout: 5000 })).toBeVisible()
    expect(deleteVisitApi).toHaveBeenCalledWith(7)
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Visit deleted successfully' })])
  }, 20_000)

  it('adds a charge line, pointing at the visit’s own diagnoses', async () => {
    await openVisit()
    const section = screen.getByRole('region', { name: 'Charge lines' })
    await userEvent.click(within(section).getByRole('button', { name: 'Add charge line' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add charge line' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add charge line' }))
    expect(await within(dialog).findByText('Select a procedure code.')).toBeVisible()
    await choose(dialog, /^procedure code/i, /^97530/)
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^modifiers/i }), 'gp')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^diagnosis pointers/i }))
    await userEvent.click(await screen.findByRole('option', { name: /^2 · M25\.511/ }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add charge line' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(addChargeLine).toHaveBeenCalledWith({
      visit_id: 7,
      procedure_code_id: 97530,
      units: 1,
      modifiers: ['GP'],
      diagnosis_pointers: [2],
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Charge line created successfully' })])
    expect(await within(section).findByText('97530')).toBeInTheDocument()
  }, 20_000)

  it('edits a charge line — every field sent, a cleared note as none', async () => {
    await openVisit()
    const section = screen.getByRole('region', { name: 'Charge lines' })
    await userEvent.click(within(section).getByRole('button', { name: 'Edit charge line 2 (97140)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit charge line' })
    expect(within(dialog).getByRole('textbox', { name: /^modifiers/i })).toHaveValue('GP, 59')
    const units = within(dialog).getByRole('textbox', { name: /^units/i })
    await userEvent.clear(units)
    await userEvent.type(units, '3')
    await userEvent.clear(within(dialog).getByRole('textbox', { name: /^notes/i }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save charge line' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateChargeLine).toHaveBeenCalledWith(72, {
      procedure_code_id: 97140,
      units: 3,
      modifiers: ['GP', '59'],
      diagnosis_pointers: [2, 1],
      place_of_service: '11',
      notes: null,
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Charge line updated successfully' })])
    await waitFor(() =>
      expect(within(section).getByText('97140').closest('tr')).not.toHaveTextContent(
        'Patient tolerated well',
      ),
    )
  }, 20_000)

  it('deletes a charge line after asking', async () => {
    await openVisit()
    const section = screen.getByRole('region', { name: 'Charge lines' })
    await userEvent.click(within(section).getByRole('button', { name: 'Delete charge line 1 (97110)' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this charge line?' })
    expect(confirm).toHaveTextContent('97110 × 2 comes off the visit, and its total with it.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete charge line' }))
    await waitFor(() => expect(within(section).queryByText('97110')).not.toBeInTheDocument())
    expect(deleteChargeLine).toHaveBeenCalledWith(71)
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Charge line deleted successfully' })])
  }, 20_000)

  it('bills a released visit — the whole visit, to an insurance not billed yet', async () => {
    visits = [{ ...VISIT, status: 'released', releasedAt: '2026-10-09T16:27:04.000000Z' }]
    claims = []
    await openVisit()
    const section = await screen.findByRole('region', { name: 'Claims' }, { timeout: 5000 })
    await userEvent.click(await within(section).findByRole('button', { name: 'Create claim' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create claim' })
    expect(dialog).toHaveTextContent('The visit on 09/14/2026 — all 2 of its charge lines, $105.00.')
    expect(within(dialog).getByRole('combobox', { name: /^bill to/i })).toHaveTextContent(
      '1003 – Aetna (primary)',
    )
    // The format starts as the server's own default.
    expect(within(dialog).getByRole('combobox', { name: /^format/i })).toHaveTextContent('837P (electronic)')
    await choose(dialog, /^format/i, 'CMS-1500 (paper)')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create claim' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // The visit, the insurance and the format — the payload's fields, and only those.
    expect(createClaimMock).toHaveBeenCalledWith({ visit_id: 7, case_insurance_id: 30, format: 'CMS1500' })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Claim created and scrubbed' })])
    expect(await within(section).findByText('Scrubbed')).toBeInTheDocument()
    // Each insurance once: nothing left to bill.
    expect(within(section).queryByRole('button', { name: 'Create claim' })).not.toBeInTheDocument()
  }, 20_000)

  it('offers no claim before the visit is released', async () => {
    claims = []
    await openVisit()
    const section = await screen.findByRole('region', { name: 'Claims' }, { timeout: 5000 })
    expect(
      await within(section).findByText(/Release the visit first: only a released visit can be billed\./),
    ).toBeVisible()
    expect(within(section).queryByRole('button', { name: 'Create claim' })).not.toBeInTheDocument()
  }, 20_000)

  it('moves a claim on — only what changed is sent', async () => {
    await openVisit()
    const section = await screen.findByRole('region', { name: 'Claims' }, { timeout: 5000 })
    await userEvent.click(
      await within(section).findByRole('button', { name: 'Edit the claim to 1003 – Aetna' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Edit claim' })
    // Where the server allows it next.
    await choose(dialog, /^status/i, 'Sent')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save claim' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateClaimMock).toHaveBeenCalledWith(1, { status: 'sent' })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Claim updated successfully' })])
    expect(await within(section).findByText('Sent', { selector: 'span' })).toBeInTheDocument()
    // Sent: it can no longer be deleted, nor scrubbed again.
    expect(
      within(section).queryByRole('button', { name: 'Delete the claim to 1003 – Aetna' }),
    ).not.toBeInTheDocument()
    expect(
      within(section).queryByRole('button', { name: 'Scrub the claim to 1003 – Aetna again' }),
    ).not.toBeInTheDocument()
  }, 20_000)

  it('scrubs a claim not yet sent again — and shows what the scrub found', async () => {
    await openVisit()
    const section = await screen.findByRole('region', { name: 'Claims' }, { timeout: 5000 })
    // The server's own claim number.
    expect(await within(section).findByText('C1')).toBeInTheDocument()
    await userEvent.click(
      await within(section).findByRole('button', { name: 'Scrub the claim to 1003 – Aetna again' }),
    )
    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({
          tone: 'warning',
          title: 'Claim scrubbed',
          description:
            'The practice billing address needs a 9-digit ZIP+4 for an electronic claim (2010AA-N403).',
        }),
      ]),
    )
    expect(scrubClaimMock).toHaveBeenCalledWith(1)
    expect(await within(section).findByText('Failed scrub')).toBeInTheDocument()
    // Not sent: it can still be scrubbed again, or deleted.
    expect(
      within(section).getByRole('button', { name: 'Delete the claim to 1003 – Aetna' }),
    ).toBeInTheDocument()
  }, 20_000)

  it('deletes a claim not yet sent, after asking — or says why not', async () => {
    deleteClaimMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'A claim that was sent cannot be deleted.',
        serverMessage: 'A claim that was sent cannot be deleted.',
        status: 422,
      }),
    )
    await openVisit()
    const section = await screen.findByRole('region', { name: 'Claims' }, { timeout: 5000 })
    const confirmDelete = async () => {
      await userEvent.click(
        await within(section).findByRole('button', { name: 'Delete the claim to 1003 – Aetna' }),
      )
      await userEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Delete this claim?' })).getByRole('button', {
          name: 'Delete claim',
        }),
      )
    }
    await confirmDelete()
    await waitFor(() =>
      expect(toasts().at(-1)).toEqual(
        expect.objectContaining({
          tone: 'error',
          title: 'The claim was not deleted',
          description: 'A claim that was sent cannot be deleted.',
        }),
      ),
    )
    await confirmDelete()
    await waitFor(() => expect(within(section).queryByText('Scrubbed')).not.toBeInTheDocument())
    expect(deleteClaimMock).toHaveBeenLastCalledWith(1)
    expect(toasts().at(-1)).toEqual(expect.objectContaining({ title: 'Claim deleted successfully' }))
  }, 20_000)
})

describe('Claims', () => {
  it('lists each claim as the server does, and opens its visit', async () => {
    renderAt('/claims')
    const table = await screen.findByRole('table', { name: 'Claims' }, { timeout: 5000 })
    const row = (await within(table).findByText('Okonkwo, Nadia', undefined, { timeout: 5000 })).closest(
      'tr',
    ) as HTMLElement
    expect(row).toHaveTextContent('09/14/2026')
    expect(row).toHaveTextContent('1003 – Aetna')
    expect(row).toHaveTextContent('Primary')
    expect(row).toHaveTextContent('837P (electronic)')
    expect(row).toHaveTextContent('$105.00')
    expect(row).toHaveTextContent('Scrubbed')
    expect(within(row).getByRole('link', { name: /Okonkwo, Nadia/ })).toHaveAttribute('href', '/visits/7')
  }, 10_000)

  it('says where claims come from when there are none', async () => {
    claims = []
    renderAt('/claims')
    expect(await screen.findByText('No claims yet', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Go to visits' })).toHaveAttribute('href', '/visits')
  })
})

describe('the patient chart — the case’s visits', () => {
  it('lists the case’s visits with their status, each opening the visit, and starts a new one on the case', async () => {
    renderAt('/patients/11')
    const card = await screen.findByRole('region', { name: 'Visits' }, { timeout: 5000 })
    const link = await within(card).findByRole('link', { name: /09\/14\/2026/ }, { timeout: 5000 })
    expect(link).toHaveAttribute('href', '/visits/7')
    expect(link).toHaveTextContent('In review')
    expect(link).toHaveTextContent('$105.00')
    // New visit opens on this case.
    await userEvent.click(within(card).getByRole('button', { name: 'New visit' }))
    const dialog = await screen.findByRole('dialog', { name: 'New visit' })
    expect(within(dialog).getByRole('combobox', { name: /^case/i })).toHaveTextContent(
      'Okonkwo, Nadia · R shoulder 2026',
    )
  }, 10_000)
})
