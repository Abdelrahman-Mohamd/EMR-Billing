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
import { createProvider, listProviders, updateProvider } from '../api/providers-api'
import { todayIso } from '@/lib/utils/dates'
import { providerResponseSchema, type Provider } from '../schemas/provider'

// Only the integration points are faked: this feature's api functions and the
// practices and insurances lists the pickers read. Everything above runs for real.
vi.mock('../api/providers-api', () => ({
  listProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
}))
// Other features' internals: faked by path, never imported (lint forbids it).
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
const insurancesMock = vi.hoisted(() => vi.fn<() => Promise<Insurance[]>>())
vi.mock('@/features/admin-insurances/api/insurances-api', () => ({
  listInsurances: insurancesMock,
  createInsurance: vi.fn(),
  updateInsurance: vi.fn(),
}))
const listMock = vi.mocked(listProviders)
const createMock = vi.mocked(createProvider)
const updateMock = vi.mocked(updateProvider)

const location = (id: number, practiceId: number, name: string) => ({
  id,
  practiceId,
  code: `L${id}`,
  name,
  npi: '1609847312',
  address: { line1: '1 Main Street', city: 'Brooklyn', state: 'NY', zip: '11209' },
  placeOfService: '11',
  isActive: true,
})
function practice(id: number, name: string, locations: Practice['locations']): Practice {
  return {
    id,
    organizationId: null,
    code: `P${id}`,
    name,
    dbaName: undefined,
    npi: '1609847312',
    taxId: '84-2217765',
    taxonomyCode: '225100000X',
    address: { line1: '1 Main Street', city: 'Brooklyn', state: 'NY', zip: '11209' },
    isActive: true,
    locations,
  }
}
// Only the fields the hold picker and list read; the rest are irrelevant here.
const insurance = (id: number, practiceId: number, name: string) =>
  ({ id, practiceId, name }) as unknown as Insurance

const isoFromToday = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return todayIso(date)
}

function provider(id: number, overrides: Record<string, unknown> = {}): Provider {
  return providerResponseSchema.parse({
    id,
    practice_id: 1,
    code: String(300 + id),
    first_name: 'Aisha',
    last_name: `Rahman${id}`,
    credential: 'PT',
    specialty: 'PHYSICAL THERAPIST',
    provider_type: 'Billing',
    npi: '1356482917',
    taxonomy_code: '225100000X',
    state_license: 'NY 041822',
    claim_hold_from: null,
    claim_hold_until: null,
    claim_hold_reason: null,
    claim_hold_location_ids: [],
    claim_hold_insurance_ids: [],
    is_active: true,
    ...overrides,
  })
}

let providers: Provider[]

beforeEach(() => {
  providers = [
    provider(1, { first_name: 'Aisha', last_name: 'Rahman', credential: 'PT, DPT' }),
    provider(18, {
      first_name: 'Jordan',
      last_name: 'Okafor',
      provider_type: 'Rendering',
      claim_hold_from: isoFromToday(-3),
      claim_hold_until: isoFromToday(10),
      claim_hold_reason: 'Pending Provider Credentialing',
      claim_hold_location_ids: [1],
      claim_hold_insurance_ids: [3],
    }),
    provider(27, { first_name: 'Caleb', last_name: 'Wright', npi: '', is_active: false }),
    provider(10, { practice_id: 2, first_name: 'Noah', last_name: 'Feldman' }),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(providers)))
  practicesMock
    .mockReset()
    .mockResolvedValue([
      practice(1, 'Harborline Physical Therapy', [location(1, 1, 'Bay Ridge'), location(2, 1, 'Park Slope')]),
      practice(2, 'Northgate Sports & Spine', [location(4, 2, 'Northgate Main')]),
    ])
  insurancesMock
    .mockReset()
    .mockResolvedValue([
      insurance(3, 1, 'Aetna'),
      insurance(4, 1, 'UnitedHealthcare'),
      insurance(9, 2, 'Medicare Part B'),
    ])
  createMock.mockReset().mockImplementation(() => Promise.resolve(providers[0] as Provider))
  updateMock.mockReset().mockImplementation(() => Promise.resolve(providers[0] as Provider))
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/setup/providers') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.findByRole('table', { name: 'Providers' })

async function choose(dialog: HTMLElement, combobox: RegExp, option: RegExp) {
  const control = within(dialog).getByRole('combobox', { name: combobox })
  await waitFor(() => expect(control).not.toHaveAttribute('aria-disabled', 'true'))
  await userEvent.click(control)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('Setup → Providers', () => {
  it('is Setup’s first section — /setup opens it — and not under Admin', async () => {
    const { router } = renderAt('/setup')
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Providers' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/setup/providers')
    const sections = screen.getByRole('navigation', { name: 'Setup' })
    expect(within(sections).getAllByRole('link')[0]).toHaveTextContent('Providers')
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('lists providers as the prototype does: ID, name and specialty, NPI, hold, type, status', async () => {
    renderAt()
    await within(await table()).findByText('Jordan Okafor, PT')
    const headers = within(await table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    // The prototype's columns; its "Taxonomy · license" column is shown under the NPI.
    expect(headers.slice(0, 6)).toEqual([
      'Provider ID',
      'Provider',
      'NPI',
      'Claim hold',
      'Provider type',
      'Active',
    ])
    const rows = within(await table()).getAllByRole('row')
    // Sorted by Provider ID: 301, 310 (other practice), 318, 327.
    const okafor = rows.find((row) => row.textContent?.includes('Jordan Okafor')) as HTMLElement
    expect(okafor).toHaveTextContent('318')
    expect(okafor).toHaveTextContent('PHYSICAL THERAPIST')
    expect(okafor).toHaveTextContent('Taxonomy 225100000X')
    expect(okafor).toHaveTextContent('License NY 041822')
    expect(okafor).toHaveTextContent('Pending Provider Credentialing')
    // The hold names the location and payer it covers, from real lists.
    expect(okafor).toHaveTextContent('Bay Ridge · Aetna')
    expect(okafor).toHaveTextContent('Claims put on hold')
    const wright = rows.find((row) => row.textContent?.includes('Caleb Wright')) as HTMLElement
    expect(within(wright).getAllByText(/Missing|NPI missing/).length).toBeGreaterThan(0)
    expect(within(wright).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
    const rahman = rows.find((row) => row.textContent?.includes('Aisha Rahman')) as HTMLElement
    expect(rahman).toHaveTextContent('Eligible for submission')
  })

  it('filters to one practice from the URL', async () => {
    renderAt('/setup/providers?practice=2')
    await within(await table()).findByText('Noah Feldman, PT')
    expect(within(await table()).getAllByRole('row')).toHaveLength(2)
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status', {}, { timeout: 5000 })).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await within(await table()).findByText('Jordan Okafor, PT')).toBeInTheDocument()
  })

  it('explains an empty list and offers to add the first provider', async () => {
    providers = []
    renderAt()
    expect(await screen.findByText('No providers yet', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add a provider' }))
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { name: 'New provider' }),
    ).toBeInTheDocument()
  })

  it('opens the prototype’s form — with Provider type, without payer enrollment — and refuses it empty', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New provider' }, { timeout: 5000 }))
    const dialog = screen.getByRole('dialog')
    for (const name of [
      /^first name/i,
      /^last name/i,
      /^credential/i,
      /^provider id/i,
      /individual npi/i,
      /taxonomy/i,
      /state license/i,
      /^reason/i,
    ]) {
      expect(within(dialog).getByRole('textbox', { name })).toBeInTheDocument()
    }
    expect(within(dialog).getByRole('textbox', { name: /^first name/i })).toHaveAttribute(
      'placeholder',
      'Enter first name',
    )
    expect(within(dialog).getByRole('textbox', { name: /^reason/i })).toHaveAttribute(
      'placeholder',
      'Enter hold reason',
    )
    expect(within(dialog).getByRole('heading', { name: 'Claim hold' })).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent(/enrollment|credentialing \(|payer enrol/i)
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeChecked()

    await userEvent.click(within(dialog).getByRole('combobox', { name: /provider type/i }))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'RenderingClaims put on hold',
      'BillingEligible for submission',
    ])
    await userEvent.keyboard('{Escape}')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save provider' }))
    for (const message of [
      'Select a practice.',
      'Enter the first name.',
      'Select a provider type.',
      'Enter the NPI.',
    ]) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }
    expect(createMock).not.toHaveBeenCalled()
  })

  it('adds a provider with a type and a hold scoped to the practice’s own locations and payers', async () => {
    renderAt('/setup/providers?practice=1')
    await userEvent.click(await screen.findByRole('button', { name: 'New provider' }, { timeout: 5000 }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^first name/i }), 'Priya')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^last name/i }), 'Raman')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^provider id/i }), '340')
    await choose(dialog, /provider type/i, /^Rendering/)
    await userEvent.type(within(dialog).getByRole('textbox', { name: /individual npi/i }), '1386950417')

    await userEvent.type(within(dialog).getByRole('textbox', { name: /hold from/i }), '10/01/2026')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /hold until/i }), '10/31/2026')
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /^reason/i }),
      'Pending Provider Credentialing',
    )
    // Only this practice's locations and payers are offered.
    await userEvent.click(within(dialog).getByRole('combobox', { name: /locations the hold covers/i }))
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Bay Ridge',
      'Park Slope',
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Park Slope' }))
    await userEvent.keyboard('{Escape}')
    await choose(dialog, /payers the hold covers/i, /UnitedHealthcare/)
    await userEvent.keyboard('{Escape}')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save provider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        practiceId: '1',
        firstName: 'Priya',
        lastName: 'Raman',
        code: '340',
        providerType: 'Rendering',
        npi: '1386950417',
        claimHoldFrom: '2026-10-01',
        claimHoldUntil: '2026-10-31',
        claimHoldReason: 'Pending Provider Credentialing',
        claimHoldLocationIds: ['2'],
        claimHoldInsuranceIds: ['4'],
        isActive: true,
      }),
    )
    expect(await screen.findByText('Provider saved')).toBeInTheDocument()
  }, 20_000)

  it('edits a provider: values and type filled in, practice fixed, type changed and saved', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Jordan Okafor, PT' }, { timeout: 5000 }),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Jordan Okafor, PT' })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /^practice/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(within(dialog).getByRole('combobox', { name: /provider type/i })).toHaveTextContent('Rendering')
    expect(within(dialog).getByRole('textbox', { name: /^reason/i })).toHaveValue(
      'Pending Provider Credentialing',
    )
    await choose(dialog, /provider type/i, /^Billing/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save provider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(
      18,
      expect.objectContaining({ providerType: 'Billing', code: '318', claimHoldLocationIds: ['1'] }),
    )
  })

  it('puts a server’s field error on the field and keeps the dialog', async () => {
    updateMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        fieldErrors: [{ path: 'npi', message: 'This NPI is already used.' }],
      }),
    )
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Aisha Rahman, PT, DPT' }, { timeout: 5000 }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save provider' }))
    expect(await screen.findByText('This NPI is already used.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
