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
import { createVisit as createVisitApi, listVisits, addChargeLine } from '../api/visits-api'
import type { Visit } from '../schemas/visit'

// Only the integration points are faked: this feature's api functions, the
// claims api, and the practices and providers lists the pickers read. Patients
// and procedure codes are the development samples those features load in
// tests (the case "R shoulder 2026" of Nadia Okonkwo, code 97110 …).
vi.mock('../api/visits-api', () => ({ listVisits: vi.fn(), createVisit: vi.fn(), addChargeLine: vi.fn() }))
const listClaimsMock = vi.hoisted(() => vi.fn())
const createClaimMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/claims/api/claims-api', () => ({
  listClaims: listClaimsMock,
  createClaim: createClaimMock,
}))
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
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
    providerType: 'Billing',
    npi: '1356482917',
    taxonomyCode: '225100000X',
    stateLicense: '',
    claimHold: { from: null, until: null, reason: '', locationIds: [], insuranceIds: [] },
    isActive: true,
  }) as unknown as Provider

const VISIT: Visit = {
  id: 7,
  caseId: 'p1-case',
  dateOfService: '2026-09-14',
  locationId: 1,
  billingProviderId: 1,
  treatingProviderId: 2,
  authorizationId: null,
  chargeLines: [
    { id: 71, visitId: 7, procedureCode: '97110', units: 2, modifiers: ['GP'], diagnosisPointers: [1] },
    {
      id: 72,
      visitId: 7,
      procedureCode: '97140',
      units: 1,
      modifiers: ['GP', '59'],
      diagnosisPointers: [2, 1],
    },
  ],
}

let visits: Visit[]

beforeEach(() => {
  visits = [VISIT]
  vi.mocked(listVisits)
    .mockReset()
    .mockImplementation(() => Promise.resolve(visits.map((visit) => ({ ...visit }))))
  vi.mocked(createVisitApi)
    .mockReset()
    .mockImplementation((payload) => {
      const created: Visit = {
        id: 8,
        caseId: payload.case_id,
        dateOfService: payload.date_of_service,
        locationId: payload.location_id,
        billingProviderId: payload.billing_provider_id,
        treatingProviderId: payload.treating_provider_id,
        authorizationId: payload.authorization_id,
        chargeLines: payload.charge_lines.map((line, index) => ({
          id: 80 + index,
          visitId: 8,
          procedureCode: line.procedure_code_id,
          units: line.units,
          modifiers: line.modifiers ?? [],
          diagnosisPointers: line.diagnosis_pointers ?? [],
        })),
      }
      visits = [created, ...visits]
      return Promise.resolve(created)
    })
  vi.mocked(addChargeLine)
    .mockReset()
    .mockImplementation((payload) => {
      const line = {
        id: 99,
        visitId: payload.visit_id,
        procedureCode: payload.procedure_code_id,
        units: payload.units,
        modifiers: payload.modifiers ?? [],
        diagnosisPointers: payload.diagnosis_pointers ?? [],
      }
      visits = visits.map((visit) =>
        visit.id === payload.visit_id ? { ...visit, chargeLines: [...visit.chargeLines, line] } : visit,
      )
      return Promise.resolve(line)
    })
  listClaimsMock
    .mockReset()
    .mockResolvedValue([
      { id: 1, visitId: 7, procedureCode: '97110', units: 2, modifiers: ['GP'], diagnosisPointers: [1] },
    ])
  createClaimMock.mockReset().mockImplementation((payload: Record<string, unknown>) =>
    Promise.resolve({
      id: 2,
      visitId: payload.visit_id,
      procedureCode: payload.procedure_code_id,
      units: payload.units,
      modifiers: payload.modifiers ?? [],
      diagnosisPointers: payload.diagnosis_pointers ?? [],
    }),
  )
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

describe('Visits — the list', () => {
  it('lists each visit with its patient, case, date, location, provider and charge lines', async () => {
    renderAt('/visits')
    const table = await screen.findByRole('table', { name: 'Visits' }, { timeout: 5000 })
    const row = (await within(table).findByText('Okonkwo, Nadia', undefined, { timeout: 5000 })).closest(
      'tr',
    ) as HTMLElement
    expect(row).toHaveTextContent('R shoulder 2026')
    expect(row).toHaveTextContent('09/14/2026')
    expect(row).toHaveTextContent('Bay Ridge')
    expect(row).toHaveTextContent('Marcus Delaney, PT')
    expect(row).toHaveTextContent('97110 × 2 · 97140')
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

  it('records a visit on a case with two charge lines, as the payload carries them', async () => {
    const router = renderAt('/patients/p1')
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

    await userEvent.click(within(form).getByRole('button', { name: 'Create visit' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/visits/8'))
    expect(createVisitApi).toHaveBeenCalledWith({
      case_id: 'p1-case',
      // New visits start on today's date.
      date_of_service: todayIso(),
      location_id: 2,
      billing_provider_id: 1,
      treating_provider_id: 2,
      authorization_id: null,
      charge_lines: [
        { procedure_code_id: '97110', units: 2 },
        { procedure_code_id: '97140', units: 1, modifiers: ['GP', '59'], diagnosis_pointers: [2, 1] },
      ],
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Visit created' })])
    expect(await screen.findByRole('heading', { level: 1, name: /^Nadia Okonkwo · / })).toBeInTheDocument()
  }, 30_000)

  it('removes a charge line, and keeps the form when the save fails', async () => {
    vi.mocked(createVisitApi).mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'offline' }))
    renderAt('/patients/p1')
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
    expect(
      await within(form).findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeVisible()
    // The dialog stays open with what was entered.
    expect(screen.getByRole('dialog', { name: 'New visit' })).toBeInTheDocument()
  }, 30_000)
})

describe('Visits — one visit, its charge lines and claims', () => {
  it('shows the visit and its charge lines, with the diagnoses each points to', async () => {
    renderAt('/visits/7')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nadia Okonkwo · 09/14/2026' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const details = screen.getByRole('region', { name: 'Visit details' })
    expect(details).toHaveTextContent('R shoulder 2026')
    expect(await within(details).findByText('Bay Ridge')).toBeInTheDocument()
    expect(details).toHaveTextContent('Aisha Rahman, PT, DPT')
    expect(details).toHaveTextContent('Marcus Delaney, PT')
    const lines = screen.getByRole('table', { name: /^Charge lines of the visit/ })
    const manual = within(lines).getByText('97140').closest('tr') as HTMLElement
    expect(manual).toHaveTextContent('Manual therapy techniques')
    expect(manual).toHaveTextContent('GP, 59')
    expect(manual).toHaveTextContent('2 · M25.511, 1 · M75.101')
    // Back to the case it belongs to.
    expect(screen.getByRole('link', { name: 'Open chart' })).toHaveAttribute(
      'href',
      '/patients/p1?case=p1-case#case',
    )
  }, 10_000)

  it('adds a charge line to the visit', async () => {
    renderAt('/visits/7')
    await screen.findByRole('heading', { level: 1, name: 'Nadia Okonkwo · 09/14/2026' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Add charge line' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add charge line' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add charge line' }))
    expect(await within(dialog).findByText('Select a procedure code.')).toBeVisible()
    await choose(dialog, /^procedure code/i, /^97530/)
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^modifiers/i }), 'gp')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add charge line' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(addChargeLine).toHaveBeenCalledWith({
      visit_id: 7,
      procedure_code_id: '97530',
      units: 1,
      modifiers: ['GP'],
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Charge line added' })])
    expect(
      await within(screen.getByRole('table', { name: /^Charge lines of the visit/ })).findByText('97530'),
    ).toBeInTheDocument()
  }, 20_000)

  it('creates a claim from one of its charge lines — the line’s values, copied', async () => {
    renderAt('/visits/7')
    const claims = await screen.findByRole('region', { name: 'Claims' }, { timeout: 5000 })
    expect(await within(claims).findByText('97110')).toBeInTheDocument()
    await userEvent.click(within(claims).getByRole('button', { name: 'Create claim' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create claim' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create claim' }))
    expect(await within(dialog).findByText('Select a charge line.')).toBeVisible()
    await choose(dialog, /^charge line/i, '97140 × 1 · GP, 59')
    expect(within(dialog).getByText('2 · M25.511, 1 · M75.101')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create claim' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createClaimMock).toHaveBeenCalledWith({
      visit_id: 7,
      procedure_code_id: '97140',
      units: 1,
      modifiers: ['GP', '59'],
      diagnosis_pointers: [2, 1],
    })
    expect(toasts()).toEqual([expect.objectContaining({ title: 'Claim created' })])
  }, 20_000)
})

describe('Claims', () => {
  it('lists each claim with the visit and line it came from, and opens the visit', async () => {
    renderAt('/claims')
    const table = await screen.findByRole('table', { name: 'Claims' }, { timeout: 5000 })
    const row = (await within(table).findByText('Okonkwo, Nadia', undefined, { timeout: 5000 })).closest(
      'tr',
    ) as HTMLElement
    expect(row).toHaveTextContent('R shoulder 2026')
    expect(row).toHaveTextContent('09/14/2026')
    expect(row).toHaveTextContent('97110 × 2')
    expect(row).toHaveTextContent('Therapeutic exercise')
    expect(row).toHaveTextContent('GP')
    expect(within(row).getByRole('link', { name: /Okonkwo, Nadia/ })).toHaveAttribute('href', '/visits/7')
  }, 10_000)

  it('says where claims come from when there are none', async () => {
    listClaimsMock.mockResolvedValue([])
    renderAt('/claims')
    expect(await screen.findByText('No claims yet', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Go to visits' })).toHaveAttribute('href', '/visits')
  })
})

describe('the patient chart — the case’s visits', () => {
  it('lists the case’s visits, each opening the visit, and starts a new one on the case', async () => {
    renderAt('/patients/p1')
    const card = await screen.findByRole('region', { name: 'Visits' }, { timeout: 5000 })
    expect(
      await within(card).findByRole('link', { name: /09\/14\/2026/ }, { timeout: 5000 }),
    ).toHaveAttribute('href', '/visits/7')
    // New visit opens on this case.
    await userEvent.click(within(card).getByRole('button', { name: 'New visit' }))
    const dialog = await screen.findByRole('dialog', { name: 'New visit' })
    expect(within(dialog).getByRole('combobox', { name: /^case/i })).toHaveTextContent(
      'Okonkwo, Nadia · R shoulder 2026',
    )
  }, 10_000)
})
