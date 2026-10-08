import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Organization } from '@/features/admin-organizations'
import {
  createLocation,
  createPractice,
  deleteLocation,
  deletePractice,
  getPractice,
  listPractices,
  setLocationActive,
  updateLocation,
  updatePractice,
} from '../api/practices-api'
import type { Location, Practice, PracticeSummary } from '../schemas/practice'

// Only the integration points are faked — this feature's api functions and
// the organizations list it reads (TESTING_STRATEGY §5). Route, queries,
// tables, dialogs and forms run for real.
vi.mock('../api/practices-api', () => ({
  listPractices: vi.fn(),
  getPractice: vi.fn(),
  deletePractice: vi.fn(),
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationActive: vi.fn(),
  deleteLocation: vi.fn(),
}))
// Another feature's internals: faked by path, never imported (lint forbids it).
const organizationsMock = vi.hoisted(() => vi.fn<() => Promise<Organization[]>>())
vi.mock('@/features/admin-organizations/api/organizations-api', () => ({
  listAllOrganizations: organizationsMock,
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}))
const listMock = vi.mocked(listPractices)
const getMock = vi.mocked(getPractice)
const deleteMock = vi.mocked(deletePractice)
const createPracticeMock = vi.mocked(createPractice)
const updatePracticeMock = vi.mocked(updatePractice)
const createLocationMock = vi.mocked(createLocation)
const updateLocationMock = vi.mocked(updateLocation)
const setActiveMock = vi.mocked(setLocationActive)
const deleteLocationMock = vi.mocked(deleteLocation)

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 1,
    practiceId: 1,
    code: 'BR003',
    name: 'Bay Ridge',
    npi: '1609847312',
    address: { line1: '8622 5th Avenue', city: 'Brooklyn', state: 'NY', zip: '11209' },
    placeOfService: '11',
    isActive: true,
    ...overrides,
  }
}

function makePractice(overrides: Partial<Practice> = {}): Practice {
  const { organizationName = 'Harborline Rehab Group', ...rest } = overrides
  return {
    id: 1,
    organizationId: 1,
    // The record names its organization; one in none has no name.
    ...(rest.organizationId === null ? {} : { organizationName }),
    code: 'HPT1',
    name: 'Harborline Physical Therapy',
    dbaName: 'Harborline PT',
    npi: '1609847312',
    taxId: '84-2217765',
    taxonomyCode: '225100000X',
    address: { line1: '8622 5th Avenue', line2: 'Suite 2', city: 'Brooklyn', state: 'NY', zip: '11209' },
    isActive: true,
    locations: [],
    ...rest,
  }
}

/** What the list carries: no DBA, address or locations — only their count. */
function summaryOf({ dbaName: _dba, address: _address, locations, ...practice }: Practice): PracticeSummary {
  return { ...practice, locationsCount: locations.length }
}

let practices: Practice[]
let organizations: Organization[]

beforeEach(() => {
  practices = [
    makePractice({
      locations: [
        makeLocation(),
        makeLocation({
          id: 2,
          code: 'PS002',
          name: 'Park Slope',
          placeOfService: undefined,
          isActive: false,
        }),
      ],
    }),
    makePractice({
      id: 2,
      code: 'NSS2',
      name: 'Northgate Sports & Spine',
      dbaName: undefined,
      organizationId: null,
      locations: [makeLocation({ id: 3, practiceId: 2, code: 'NG001', name: 'Northgate Main' })],
    }),
  ]
  organizations = [
    {
      id: 1,
      name: 'Harborline Rehab Group',
      isActive: true,
      practicesCount: 1,
      createdAt: '2026-10-07T16:06:23.000000Z',
    },
    {
      id: 2,
      name: 'Alder Therapy Partners',
      isActive: false,
      practicesCount: 0,
      createdAt: '2026-10-07T16:06:23.000000Z',
    },
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(practices.map(summaryOf)))
  getMock.mockReset().mockImplementation((id) => {
    const found = practices.find((practice) => practice.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  organizationsMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(organizations)))
  createPracticeMock.mockReset().mockImplementation((values) => {
    // As the backend answers: no record back.
    practices = [
      ...practices,
      makePractice({ id: 3, name: values.name, code: values.code, organizationId: null }),
    ]
    return Promise.resolve(null)
  })
  updatePracticeMock.mockReset().mockImplementation(() => Promise.resolve(null))
  deleteMock.mockReset().mockImplementation((id) => {
    practices = practices.filter((practice) => practice.id !== id)
    return Promise.resolve(null)
  })
  createLocationMock.mockReset().mockImplementation((practiceId, values) => {
    const created = makeLocation({ id: 9, practiceId, code: values.code, name: values.name })
    practices = practices.map((p) =>
      p.id === practiceId ? { ...p, locations: [...p.locations, created] } : p,
    )
    return Promise.resolve(null)
  })
  updateLocationMock.mockReset().mockImplementation(() => Promise.resolve(null))
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    practices = practices.map((p) => ({
      ...p,
      locations: p.locations.map((l) => (l.id === id ? { ...l, isActive } : l)),
    }))
    return Promise.resolve(null)
  })
  deleteLocationMock.mockReset().mockImplementation((id) => {
    practices = practices.map((p) => ({ ...p, locations: p.locations.filter((l) => l.id !== id) }))
    return Promise.resolve(null)
  })
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/practices') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const practicePicker = () => screen.getByRole('navigation', { name: 'Practices' })
const locationsTable = () => screen.getByRole('table', { name: 'Locations' })
const field = (name: RegExp) => screen.getByRole('textbox', { name })

async function fillPractice() {
  await userEvent.type(field(/^practice name/i), 'Cedar Valley Therapy')
  await userEvent.type(field(/^practice code/i), 'CVT1')
  await userEvent.type(field(/^street address/i), '100 Main Street')
  // The practice's address is the first of the two in a new-practice form.
  await userEvent.type(screen.getAllByRole('textbox', { name: /^city/i })[0] as HTMLElement, 'Brooklyn')
  await userEvent.type(screen.getAllByRole('textbox', { name: /^state/i })[0] as HTMLElement, 'ny')
  await userEvent.type(screen.getAllByRole('textbox', { name: /^zip/i })[0] as HTMLElement, '11209')
  await userEvent.type(field(/^tax id/i), '12-3456789')
  await userEvent.type(field(/^taxonomy code/i), '225100000x')
  await userEvent.type(field(/^group npi/i), '1234567893')
}

describe('Admin → Practices & locations: practices', () => {
  it('lists the practices and shows the first one with its organization and billing constants', async () => {
    renderAt()
    // The first test pays for loading the route's code-split chunk; under a
    // full, parallel run the default one second is not always enough.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Practices & locations' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const sections = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(sections).getByRole('link', { name: 'Practices & locations' })).toHaveAttribute(
      'data-status',
      'active',
    )

    const picker = await screen.findByRole('navigation', { name: 'Practices' })
    expect(picker).toHaveTextContent('2 practices')
    const tiles = within(picker).getAllByRole('link')
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      expect.stringContaining('Harborline Physical Therapy'),
      expect.stringContaining('Northgate Sports & Spine'),
    ])
    // A tile tells practices apart — name, code, how many locations (the list's
    // count, inactive Park Slope included) — without repeating the identifiers
    // shown below it.
    expect(tiles[0]).toHaveTextContent('HPT1')
    expect(tiles[0]).toHaveTextContent('2 locations')
    expect(tiles[0]).not.toHaveTextContent('1609847312')
    // The first practice is the one on show, and its tile says so.
    expect(tiles[0]).toHaveAttribute('aria-current', 'page')
    expect(tiles[1]).not.toHaveAttribute('aria-current')

    const details = await screen.findByRole('region', { name: 'Harborline Physical Therapy' })
    expect(within(details).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Harborline Physical Therapy',
    )
    expect(details).toHaveTextContent('DBA Harborline PT')
    expect(within(details).getByRole('heading', { level: 3, name: 'Billing details' })).toBeInTheDocument()
    expect(within(details).getByText('8622 5th Avenue, Suite 2, Brooklyn, NY 11209')).toBeInTheDocument()
    expect(
      within(details).getByRole('button', { name: 'About Billing details' }),
    ).toHaveAccessibleDescription(/Printed on every claim/)
    // Its organization, one click from its screen.
    expect(await within(details).findByRole('link', { name: /Harborline Rehab Group/ })).toHaveAttribute(
      'href',
      '/admin/organizations',
    )
  })

  it('opens another practice from its tile and keeps the choice in the address', async () => {
    const { router } = renderAt()
    const picker = await screen.findByRole('navigation', { name: 'Practices' })
    await userEvent.click(within(picker).getByRole('link', { name: /Northgate Sports & Spine/ }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Northgate Sports & Spine' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ practice: 2 })
    expect(within(practicePicker()).getByRole('link', { name: /Northgate Sports & Spine/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // In no organization: no organization link.
    expect(
      within(screen.getByRole('region', { name: 'Northgate Sports & Spine' })).queryByRole('link', {
        name: /Harborline Rehab Group/,
      }),
    ).not.toBeInTheDocument()
    expect(within(locationsTable()).getByText('Northgate Main')).toBeInTheDocument()
  })

  it('opens the practice named in the address', async () => {
    renderAt('/admin/practices?practice=2')
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Northgate Sports & Spine' }),
    ).toBeInTheDocument()
  })

  it('falls back to the first practice for an id that does not exist', async () => {
    renderAt('/admin/practices?practice=999')
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Harborline Physical Therapy' }),
    ).toBeInTheDocument()
  })

  it('shows a loading state, and a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await screen.findByRole('navigation', { name: 'Practices' })).toHaveTextContent(
      'Harborline Physical Therapy',
    )
  })

  it('explains an empty system and offers to create the first practice', async () => {
    practices = []
    renderAt()
    expect(await screen.findByText('No practices yet')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'New practice' })
    await userEvent.click(buttons[buttons.length - 1] as HTMLElement)
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { name: 'New practice' }),
    ).toBeInTheDocument()
  })

  it('creates a practice together with its first location, then lists it', async () => {
    const { router } = renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New practice' }))
    const dialog = screen.getByRole('dialog')
    expect(field(/^practice name/i)).toHaveAttribute('placeholder', 'Enter practice name')
    expect(within(dialog).getByRole('heading', { name: 'First location (required)' })).toBeInTheDocument()

    await fillPractice()
    await userEvent.type(field(/^location name/i), 'Bay Ridge')
    await userEvent.type(field(/^location code/i), 'BR003')
    await userEvent.type(field(/^rendering address/i), '7501 3rd Avenue')
    // Two addresses in one form: the location's city, state and ZIP come second.
    await userEvent.type(screen.getAllByRole('textbox', { name: /^city/i })[1] as HTMLElement, 'Brooklyn')
    await userEvent.type(screen.getAllByRole('textbox', { name: /^state/i })[1] as HTMLElement, 'NY')
    await userEvent.type(screen.getAllByRole('textbox', { name: /^zip/i })[1] as HTMLElement, '11209')
    await userEvent.type(field(/^facility or group npi/i), '1234567893')
    // Place of service starts at 11 (PRD V2 §10.2).
    expect(within(dialog).getByRole('combobox', { name: /default place of service/i })).toHaveTextContent(
      '11 — Office',
    )

    await userEvent.click(within(dialog).getByRole('button', { name: 'Create practice' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createPracticeMock).toHaveBeenCalledWith({
      organizationId: null,
      code: 'CVT1',
      name: 'Cedar Valley Therapy',
      dbaName: '',
      npi: '1234567893',
      taxId: '12-3456789',
      taxonomyCode: '225100000X',
      address: { line1: '100 Main Street', line2: '', city: 'Brooklyn', state: 'NY', zip: '11209' },
      isActive: true,
      location: {
        code: 'BR003',
        name: 'Bay Ridge',
        npi: '1234567893',
        address: { line1: '7501 3rd Avenue', city: 'Brooklyn', state: 'NY', zip: '11209' },
        placeOfService: '11',
      },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Cedar Valley Therapy created')
    // The response carries no record to open, so the list is read again and shows it; the
    // practice on screen stays the one that was open.
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(1))
    expect(await screen.findByText('Cedar Valley Therapy')).toBeInTheDocument()
    expect(router.state.location.search).not.toHaveProperty('practice', 3)
    // Two full addresses typed key by key: slower than the default five seconds.
  }, 30_000) // A long form, typed key by key.

  it('explains optional context from info icons beside the labels, not as loose notes', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New practice' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'About Tax ID' })).toHaveAccessibleDescription(
      /EIN \(00-0000000\) or an SSN \(000-00-0000\)/,
    )
    expect(within(dialog).getByRole('button', { name: 'About Organization' })).toHaveAccessibleDescription(
      /Groups practices that share an owner/,
    )
    // The field keeps its own name; the icon is beside the label, not in it.
    expect(field(/^tax id/i)).toHaveAccessibleName('Tax ID')
    expect(within(dialog).queryByText(/EIN 00-0000000 or SSN/)).not.toBeInTheDocument()

    await userEvent.hover(within(dialog).getByRole('button', { name: 'About Location code' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /No two locations of a practice can share one/,
    )
  })

  it('asks for every required field, and checks the formats the prototype checks', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New practice' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create practice' }))

    for (const message of [
      'Enter the practice name.',
      'Enter the practice code.',
      'Enter the street address.',
      'Enter the Tax ID.',
      'Enter the taxonomy code.',
      'Enter the location name.',
    ]) {
      expect(await within(dialog).findAllByText(message)).not.toHaveLength(0)
    }
    expect(field(/^practice name/i)).toHaveFocus()
    // Optional: DBA, suite, organization.
    expect(field(/^dba name/i)).not.toHaveAttribute('aria-invalid')
    expect(field(/^suite/i)).not.toHaveAttribute('aria-invalid')

    await userEvent.type(field(/^group npi/i), '12345')
    await userEvent.type(field(/^tax id/i), '123456789')
    await userEvent.type(field(/^taxonomy code/i), '2251')
    await userEvent.type(screen.getAllByRole('textbox', { name: /^zip/i })[0] as HTMLElement, '112')
    await userEvent.type(screen.getAllByRole('textbox', { name: /^state/i })[0] as HTMLElement, 'N')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create practice' }))

    expect(
      await within(dialog).findByText('Enter an EIN (00-0000000) or an SSN (000-00-0000).'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Please enter a valid taxonomy code.')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Please enter a valid NPI.')).not.toHaveLength(0)
    expect(within(dialog).getByText('Please enter a valid ZIP code.')).toBeInTheDocument()
    expect(within(dialog).getByText('Please enter a valid state.')).toBeInTheDocument()
    expect(createPracticeMock).not.toHaveBeenCalled()
    // Many fields typed key by key: slower than the default five seconds under a full run.
  }, 15_000)

  it('offers the active organizations and sends the one chosen', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New practice' }))
    const dialog = screen.getByRole('dialog')
    const organization = within(dialog).getByRole('combobox', { name: /organization/i })
    await waitFor(() => expect(organization).not.toHaveAttribute('aria-disabled', 'true'))
    await userEvent.click(organization)
    expect(screen.getByRole('option', { name: 'Harborline Rehab Group' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Alder Therapy Partners/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'Harborline Rehab Group' }))

    await fillPractice()
    await userEvent.type(field(/^location name/i), 'Bay Ridge')
    await userEvent.type(field(/^location code/i), 'BR003')
    await userEvent.type(field(/^rendering address/i), '7501 3rd Avenue')
    await userEvent.type(screen.getAllByRole('textbox', { name: /^city/i })[1] as HTMLElement, 'Brooklyn')
    await userEvent.type(screen.getAllByRole('textbox', { name: /^state/i })[1] as HTMLElement, 'NY')
    await userEvent.type(screen.getAllByRole('textbox', { name: /^zip/i })[1] as HTMLElement, '11209')
    await userEvent.type(field(/^facility or group npi/i), '1234567893')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create practice' }))

    await waitFor(() => expect(createPracticeMock).toHaveBeenCalledTimes(1))
    expect(createPracticeMock.mock.calls[0]?.[0]).toMatchObject({ organizationId: '1' })
    // Two full addresses typed key by key: slower than the default five seconds.
  }, 30_000) // A long form, typed key by key.

  it('edits a practice with its values filled in, keeping an inactive organization visible', async () => {
    practices = [makePractice({ organizationId: 2 })]
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit practice' }))
    const dialog = screen.getByRole('dialog')

    expect(
      within(dialog).getByRole('heading', { name: 'Edit Harborline Physical Therapy' }),
    ).toBeInTheDocument()
    expect(field(/^practice name/i)).toHaveValue('Harborline Physical Therapy')
    expect(field(/^suite/i)).toHaveValue('Suite 2')
    expect(field(/^dba name/i)).toHaveValue('Harborline PT')
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: /organization/i })).toHaveTextContent(
        'Alder Therapy Partners (inactive)',
      ),
    )
    // Locations are managed from the practice's section, not here.
    expect(within(dialog).queryByRole('heading', { name: /first location/i })).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save practice' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updatePracticeMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ organizationId: '2', isActive: false }),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Practice saved')
  })

  it('keeps the dialog and what was typed when saving fails', async () => {
    updatePracticeMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit practice' }))
    await userEvent.clear(field(/^practice name/i))
    await userEvent.type(field(/^practice name/i), 'Harborline PT Group')
    await userEvent.click(screen.getByRole('button', { name: 'Save practice' }))

    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument()
    expect(field(/^practice name/i)).toHaveValue('Harborline PT Group')
  })
})

describe('Admin → Practices & locations: locations', () => {
  it('lists the selected practice’s locations with address, place of service and status', async () => {
    renderAt()
    const table = await screen.findByRole('table', { name: 'Locations' })
    const bayRidge = within(table).getByText('Bay Ridge').closest('tr') as HTMLElement
    expect(bayRidge).toHaveTextContent('8622 5th Avenue, Brooklyn 11209')
    expect(bayRidge).toHaveTextContent('11 — Office')
    expect(within(bayRidge).getByRole('switch', { name: 'Bay Ridge: active' })).toBeChecked()
    const parkSlope = within(table).getByText('Park Slope').closest('tr') as HTMLElement
    expect(within(parkSlope).getByRole('switch', { name: 'Park Slope: active' })).not.toBeChecked()
    // The section counts them, saying how many are active.
    expect(screen.getByRole('heading', { level: 3, name: /^Locations/ })).toHaveTextContent('1 of 2 active')
  })

  it('adds a location to the selected practice, starting at place of service 11', async () => {
    renderAt('/admin/practices?practice=2')
    await screen.findByRole('heading', { level: 2, name: 'Northgate Sports & Spine' })
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Add a location to Northgate Sports & Spine.')).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /default place of service/i })).toHaveTextContent(
      '11 — Office',
    )
    // The standalone location payload has no suite line.
    expect(within(dialog).queryByRole('textbox', { name: /^suite/i })).not.toBeInTheDocument()

    await userEvent.type(field(/^location name/i), 'Queens')
    await userEvent.type(field(/^location code/i), 'QN002')
    await userEvent.type(field(/^rendering address/i), '37-02 Main Street')
    await userEvent.type(field(/^city/i), 'Flushing')
    await userEvent.type(field(/^state/i), 'NY')
    await userEvent.type(field(/^zip/i), '11354')
    await userEvent.type(field(/^facility or group npi/i), '1122334455')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /default place of service/i }))
    await userEvent.click(screen.getByRole('option', { name: /22 — Outpatient hospital/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add location' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createLocationMock).toHaveBeenCalledWith(2, {
      code: 'QN002',
      name: 'Queens',
      npi: '1122334455',
      address: { line1: '37-02 Main Street', city: 'Flushing', state: 'NY', zip: '11354' },
      placeOfService: '22',
      isActive: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent('Location saved')
    expect(await within(locationsTable()).findByText('Queens')).toBeInTheDocument()
  })

  it('edits a location from its row and can make it inactive', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Bay Ridge' }))
    const dialog = screen.getByRole('dialog')
    expect(field(/^location name/i)).toHaveValue('Bay Ridge')
    expect(field(/^facility or group npi/i)).toHaveValue('1609847312')

    await userEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save location' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateLocationMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ code: 'BR003', isActive: false }),
    )
  })

  it('asks for a place of service: the server keeps one on every location', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Park Slope' }))
    const dialog = screen.getByRole('dialog')
    const pos = within(dialog).getByRole('combobox', { name: /default place of service/i })
    expect(pos).toHaveTextContent('Select place of service')
    // Nothing to clear it with.
    expect(within(dialog).queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save location' }))
    expect(await within(dialog).findByText('Select the place of service.')).toBeInTheDocument()
    expect(updateLocationMock).not.toHaveBeenCalled()
  })

  it('puts a duplicate location code rejected by the server on the code field', async () => {
    createLocationMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'code', message: 'This code is already used in this practice.' }],
      }),
    )
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Add location' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(field(/^location name/i), 'Bay Ridge 2')
    await userEvent.type(field(/^location code/i), 'BR003')
    await userEvent.type(field(/^rendering address/i), '1 Main Street')
    await userEvent.type(field(/^city/i), 'Brooklyn')
    await userEvent.type(field(/^state/i), 'NY')
    await userEvent.type(field(/^zip/i), '11209')
    await userEvent.type(field(/^facility or group npi/i), '1234567893')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add location' }))

    expect(await within(dialog).findByText('This code is already used in this practice.')).toBeInTheDocument()
    await waitFor(() => expect(field(/^location code/i)).toHaveFocus())
  })

  it('deactivates a location from its row after a confirmation, changing only is_active', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('switch', { name: 'Bay Ridge: active' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Deactivate Bay Ridge?' })
    expect(confirm).toHaveTextContent('Its status becomes Inactive.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(setActiveMock).toHaveBeenCalledWith(1, false)
    expect(updateLocationMock).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Bay Ridge deactivated')
  })

  it('reactivates an inactive location, and changes nothing when the confirmation is cancelled', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('switch', { name: 'Park Slope: active' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Reactivate Park Slope?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(setActiveMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('switch', { name: 'Park Slope: active' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Reactivate Park Slope?' })).getByRole('button', {
        name: 'Reactivate',
      }),
    )
    await waitFor(() => expect(setActiveMock).toHaveBeenCalledWith(2, true))
  })

  it('says so when a status change fails', async () => {
    setActiveMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    await userEvent.click(await screen.findByRole('switch', { name: 'Bay Ridge: active' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Deactivate Bay Ridge?' })).getByRole('button', {
        name: 'Deactivate',
      }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('The location was not deactivated')
  })

  it('closes on Escape without saving and returns focus to the row', async () => {
    renderAt()
    const opener = await screen.findByRole('button', { name: 'Edit Bay Ridge' })
    await userEvent.click(opener)
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateLocationMock).not.toHaveBeenCalled()
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('deletes a practice after asking, then shows the first practice', async () => {
    const { router } = renderAt('/admin/practices?practice=2')
    await screen.findByRole('region', { name: 'Northgate Sports & Spine' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Delete practice' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Northgate Sports & Spine?' })
    expect(ask).toHaveTextContent('Its location is deleted with it.')
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete practice' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteMock).toHaveBeenCalledWith(2)
    expect(screen.getByRole('status')).toHaveTextContent('Northgate Sports & Spine deleted')
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(await screen.findByRole('region', { name: 'Harborline Physical Therapy' })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(screen.getByRole('navigation', { name: 'Practices' })).queryByText('Northgate Sports & Spine'),
      ).not.toBeInTheDocument(),
    )
  }, 15_000)

  it('keeps the practice when the delete is cancelled or refused', async () => {
    renderAt()
    await screen.findByRole('region', { name: 'Harborline Physical Therapy' }, { timeout: 5000 })
    await userEvent.click(screen.getByRole('button', { name: 'Delete practice' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteMock).not.toHaveBeenCalled()

    deleteMock.mockRejectedValueOnce(
      new ApiError({ kind: 'validation', message: 'This practice still has visits.', status: 422 }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete practice' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete practice' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          tone: 'error',
          title: 'Harborline Physical Therapy was not deleted',
          description: 'This practice still has visits.',
        }),
      ]),
    )
    expect(screen.getByRole('region', { name: 'Harborline Physical Therapy' })).toBeInTheDocument()
  }, 15_000)

  it('deletes a location after asking, and the list follows', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Park Slope' }, { timeout: 5000 }))
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Park Slope?' })
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteLocationMock).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Park Slope' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete Park Slope?' })).getByRole('button', {
        name: 'Delete location',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteLocationMock).toHaveBeenCalledWith(2)
    expect(screen.getByRole('status')).toHaveTextContent('Park Slope deleted')
    await waitFor(() => expect(within(locationsTable()).queryByText('Park Slope')).not.toBeInTheDocument())
    expect(within(locationsTable()).getByText('Bay Ridge')).toBeInTheDocument()
  }, 15_000)

  it('says so when a location delete is refused', async () => {
    deleteLocationMock.mockRejectedValueOnce(
      new ApiError({ kind: 'validation', message: 'This location has visits.', status: 422 }),
    )
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Bay Ridge' }, { timeout: 5000 }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete location' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          tone: 'error',
          title: 'Bay Ridge was not deleted',
          description: 'This location has visits.',
        }),
      ]),
    )
    expect(within(locationsTable()).getByText('Bay Ridge')).toBeInTheDocument()
  }, 15_000)

  it('shows the server message on success, and its reason when it refuses', async () => {
    deleteLocationMock.mockImplementationOnce((id) => {
      practices = practices.map((p) => ({ ...p, locations: p.locations.filter((l) => l.id !== id) }))
      return Promise.resolve('Location deleted successfully')
    })
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Park Slope' }, { timeout: 5000 }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete location' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ tone: 'success', title: 'Location deleted successfully' }),
      ]),
    )

    // The backend's answer for a practice's last location (it names no form field).
    deleteLocationMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'A practice must have at least one location; this is its last one.',
        serverMessage: 'A practice must have at least one location; this is its last one.',
        status: 422,
        fieldErrors: [
          { path: 'location', message: 'A practice must have at least one location; this is its last one.' },
        ],
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete Bay Ridge' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete location' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)).toEqual(
        expect.objectContaining({
          tone: 'error',
          description: 'A practice must have at least one location; this is its last one.',
        }),
      ),
    )
  }, 15_000)
})
