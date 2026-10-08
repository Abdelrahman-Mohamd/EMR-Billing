import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Practice } from '@/features/admin-practices'
import {
  createProvider,
  deleteProvider,
  getProvider,
  listProviders,
  setProviderActive,
  updateProvider,
} from '../api/providers-api'
import { providerResponseSchema, type Provider } from '../schemas/provider'

// Only the integration points are faked: this feature's api functions and the
// practices list the selector reads. Everything above them runs for real.
vi.mock('../api/providers-api', () => ({
  listProviders: vi.fn(),
  getProvider: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  setProviderActive: vi.fn(),
  deleteProvider: vi.fn(),
  correctProviderNpi: vi.fn(),
}))
// Another feature's internals: faked by path, never imported (lint forbids it).
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))
const listMock = vi.mocked(listProviders)
const getMock = vi.mocked(getProvider)
const createMock = vi.mocked(createProvider)
const updateMock = vi.mocked(updateProvider)
const setActiveMock = vi.mocked(setProviderActive)
const deleteMock = vi.mocked(deleteProvider)

function practice(id: number, name: string): Practice {
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
    locations: [],
  }
}

const PRACTICE_NAMES: Record<number, string> = {
  1: 'Harborline Physical Therapy',
  2: 'Northgate Sports & Spine',
}

/** A provider as the server sends them (2026-10-08), parsed by the real schema. */
function provider(id: number, overrides: Record<string, unknown> = {}): Provider {
  const practiceId = typeof overrides.practice_id === 'number' ? overrides.practice_id : 1
  return providerResponseSchema.parse({
    id,
    practice_id: practiceId,
    code: String(300 + id),
    first_name: 'Aisha',
    last_name: `Rahman${id}`,
    type: 'billing',
    type_label: 'Billing',
    credential: 'PT',
    specialty: 'PHYSICAL THERAPIST',
    npi: '1356482917',
    taxonomy_code: '225100000X',
    state_license: 'NY 041822',
    is_active: true,
    practice: { id: practiceId, name: PRACTICE_NAMES[practiceId] },
    created_at: '2026-10-08T14:35:58.000000Z',
    ...overrides,
  })
}

let providers: Provider[]

beforeEach(() => {
  providers = [
    provider(1, { first_name: 'Aisha', last_name: 'Rahman', credential: 'PT, DPT' }),
    provider(18, { first_name: 'Jordan', last_name: 'Okafor', type: 'rendering', type_label: 'Rendering' }),
    provider(27, {
      first_name: 'Caleb',
      last_name: 'Wright',
      npi: '9999999999',
      specialty: null,
      taxonomy_code: null,
      state_license: null,
      is_active: false,
    }),
    provider(10, { practice_id: 2, first_name: 'Noah', last_name: 'Feldman' }),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(providers)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, PRACTICE_NAMES[1] ?? ''), practice(2, PRACTICE_NAMES[2] ?? '')])
  getMock.mockReset().mockImplementation((id) => {
    const found = providers.find((item) => item.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  // As the backend answers: its own message, no record.
  createMock.mockReset().mockResolvedValue('Provider created successfully')
  updateMock.mockReset().mockResolvedValue('Provider updated successfully')
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    providers = providers.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Provider updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    providers = providers.filter((item) => item.id !== id)
    return Promise.resolve('Provider deleted successfully')
  })
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

  it('lists providers as the contract carries them: ID, name and specialty, NPI, type, Active', async () => {
    renderAt()
    await within(await table()).findByText('Jordan Okafor, PT')
    const headers = within(await table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    // The prototype's columns; its "Taxonomy · license" is shown under the NPI,
    // and its claim hold is not in the contract.
    expect(headers.slice(0, 5)).toEqual(['Provider ID', 'Provider', 'NPI', 'Provider type', 'Active'])
    expect(headers).not.toContain('Claim hold')
    const rows = within(await table()).getAllByRole('row')
    const okafor = rows.find((row) => row.textContent?.includes('Jordan Okafor')) as HTMLElement
    expect(okafor).toHaveTextContent('318')
    expect(okafor).toHaveTextContent('PHYSICAL THERAPIST')
    // Unfiltered, the practice the provider came with is named under them.
    expect(okafor).toHaveTextContent('Harborline Physical Therapy')
    expect(okafor).toHaveTextContent('Taxonomy 225100000X')
    expect(okafor).toHaveTextContent('License NY 041822')
    expect(okafor).toHaveTextContent('Claims put on hold')
    const wright = rows.find((row) => row.textContent?.includes('Caleb Wright')) as HTMLElement
    // A placeholder NPI is shown as it is, marked.
    expect(wright).toHaveTextContent('9999999999')
    expect(wright).toHaveTextContent('License —')
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

  it('opens the prototype’s form — without claim hold or payer enrollment — and refuses it empty', async () => {
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
    ]) {
      expect(within(dialog).getByRole('textbox', { name })).toBeInTheDocument()
    }
    expect(within(dialog).getByRole('textbox', { name: /^first name/i })).toHaveAttribute(
      'placeholder',
      'Enter first name',
    )
    expect(within(dialog).queryByRole('heading', { name: 'Claim hold' })).not.toBeInTheDocument()
    expect(dialog).not.toHaveTextContent(/hold until|enrollment|payer enrol/i)
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeChecked()
    // Rendering to start, as the server sets it when none is sent.
    expect(within(dialog).getByRole('combobox', { name: /provider type/i })).toHaveTextContent('Rendering')

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
      'Enter the last name.',
      'Enter the Provider ID.',
      'Enter the NPI.',
    ]) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }
    expect(createMock).not.toHaveBeenCalled()
  })

  it('adds a provider to the filtered practice, with the server’s message', async () => {
    renderAt('/setup/providers?practice=1')
    await userEvent.click(await screen.findByRole('button', { name: 'New provider' }, { timeout: 5000 }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^first name/i }), 'Mina')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^last name/i }), 'Shehata')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^credential/i }), 'PT')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /^provider id/i }), '297')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /individual npi/i }), '1234567893')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /state license/i }), 'NY123456')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save provider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({
      practiceId: '1',
      firstName: 'Mina',
      lastName: 'Shehata',
      credential: 'PT',
      code: '297',
      specialty: 'PHYSICAL THERAPIST',
      type: 'rendering',
      npi: '1234567893',
      taxonomyCode: '225100000X',
      stateLicense: 'NY123456',
      isActive: true,
    })
    expect(await screen.findByText('Provider created successfully')).toBeInTheDocument()
  }, 20_000)

  it('edits a provider as the server has them now: practice fixed, type changed and saved', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Jordan Okafor, PT' }, { timeout: 5000 }),
    )
    const dialog = screen.getByRole('dialog')
    expect(getMock).toHaveBeenCalledWith(18, expect.anything())
    expect(within(dialog).getByRole('heading', { name: 'Jordan Okafor, PT' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('combobox', { name: /^practice/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(within(dialog).getByRole('combobox', { name: /provider type/i })).toHaveTextContent('Rendering')
    await choose(dialog, /provider type/i, /^Billing/)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save provider' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(18, expect.objectContaining({ type: 'billing', code: '318' }))
    expect(await screen.findByText('Provider updated successfully')).toBeInTheDocument()
  })

  it('opens a provider with no specialty or taxonomy, and keeps them empty', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Caleb Wright, PT' }, { timeout: 5000 }),
    )
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('combobox', { name: /specialty/i })).toHaveTextContent(
      'Select a specialty',
    )
    expect(within(dialog).getByRole('textbox', { name: /taxonomy/i })).toHaveValue('')
  })

  it('says so when the provider was deleted before the form loaded', async () => {
    getMock.mockRejectedValueOnce(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Jordan Okafor, PT' }, { timeout: 5000 }),
    )
    expect(await screen.findByText('This provider no longer exists')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save provider' })).toBeDisabled()
  })

  it('puts a server’s field error on the field and keeps the dialog', async () => {
    updateMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'The npi has already been taken.',
        fieldErrors: [{ path: 'npi', message: 'The npi has already been taken.' }],
      }),
    )
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Aisha Rahman, PT, DPT' }, { timeout: 5000 }),
    )
    const save = screen.getByRole('button', { name: 'Save provider' })
    await waitFor(() => expect(save).toBeEnabled())
    await userEvent.click(save)
    expect(await screen.findByText('The npi has already been taken.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('changes a provider status with the Active switch, after asking', async () => {
    renderAt()
    const toggle = await screen.findByRole('switch', { name: 'Caleb Wright, PT: active' }, { timeout: 5000 })
    await userEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog', { name: 'Reactivate Caleb Wright, PT?' })
    expect(setActiveMock).not.toHaveBeenCalled()
    await userEvent.click(within(ask).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(setActiveMock).toHaveBeenCalledWith(27, true)
    expect(toggle).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('Provider updated successfully')
  })

  it('deletes a provider after asking, and says why when the server refuses', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Jordan Okafor, PT' }, { timeout: 5000 }),
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete Jordan Okafor, PT?' })).getByRole(
        'button',
        { name: 'Delete provider' },
      ),
    )
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(18))
    expect(await screen.findByText('Provider deleted successfully')).toBeInTheDocument()

    deleteMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This provider has visits.',
        serverMessage: 'This provider has visits.',
        status: 422,
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete Noah Feldman, PT' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete provider' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)).toEqual(
        expect.objectContaining({
          tone: 'error',
          title: 'Noah Feldman, PT was not deleted',
          description: 'This provider has visits.',
        }),
      ),
    )
  }, 15_000)
})
