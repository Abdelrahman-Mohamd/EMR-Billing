import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Practice } from '@/features/admin-practices'
import { formatIsoDate, todayIso } from '@/lib/utils/dates'
import { resetEmrIntegration } from '../data/integration-store'
import { notLinked, type Payload } from '../model/integration'

// EMR integration is frontend only: its in-tab store starts from a known
// state. The practices list it reads is another feature's integration point:
// faked by path, never imported (lint forbids it).
const practicesMock = vi.hoisted(() => vi.fn<() => Promise<Practice[]>>())
vi.mock('@/features/admin-practices/api/practices-api', () => ({
  listPractices: practicesMock,
  createPractice: vi.fn(),
  updatePractice: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

const location = (id: number, practiceId: number, code: string, name: string) => ({
  id,
  practiceId,
  code,
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

const payload = (
  id: number,
  locationId: number,
  result: Payload['result'],
  patient = `Patient ${id}`,
): Payload => ({
  id: String(id),
  // Newest first by id: a higher id is earlier.
  at: `2026-09-${String(20 - (id % 19)).padStart(2, '0')}T08:${String(id % 60).padStart(2, '0')}:00`,
  locationId,
  recordId: `EMR-N-${5590000 + id}`,
  patient,
  result,
  detail: `Detail ${id}`,
})

beforeEach(() => {
  practicesMock
    .mockReset()
    .mockResolvedValue([
      practice(1, 'Harborline Physical Therapy', [
        location(1, 1, 'BR003', 'Bay Ridge'),
        location(2, 1, 'PS002', 'Park Slope'),
        location(3, 1, 'SI004', 'Staten Island Annex'),
      ]),
      practice(2, 'Northgate Sports & Spine', [location(4, 2, 'NG001', 'Northgate Main')]),
    ])
  resetEmrIntegration(
    [
      {
        ...notLinked(1),
        uniqueLocationId: 'EMR-LOC-4471',
        link: 'Linked',
        election: 'Integrated',
        linkedOn: '2025-11-03',
      },
      {
        ...notLinked(3),
        uniqueLocationId: 'EMR-LOC-4480',
        link: 'Requested',
        requestedBy: 'Ivy Bennett',
        requestedOn: '2026-09-11',
      },
      {
        ...notLinked(4),
        uniqueLocationId: 'EMR-LOC-5120',
        link: 'Linked',
        election: 'Integrated',
        linkedOn: '2026-02-17',
      },
    ],
    [
      payload(1, 1, 'Accepted', 'Kevin O’Brien'),
      payload(2, 3, 'Blocked', 'Walk-in (Staten Island)'),
      payload(3, 1, 'Replaced'),
      payload(4, 4, 'Accepted', 'Northgate patient'),
    ],
  )
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/integration') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return router
}

const locationsTable = (name = 'Harborline Physical Therapy') =>
  screen.findByRole('table', { name: `Locations of ${name}` }, { timeout: 5000 })
const logTable = () => screen.findByRole('table', { name: 'Payload log' })
const rowOf = (table: HTMLElement, text: string) =>
  within(table)
    .getAllByRole('row')
    .find((row) => row.textContent?.includes(text)) as HTMLElement

describe('Admin → EMR integration', () => {
  it('shows the steps, the first practice’s locations and its payload log, with no implementation notice', async () => {
    renderAt()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'EMR integration' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Integration is set up per location. Only integrated locations send sessions into billing.',
      ),
    ).toBeVisible()
    const steps = screen.getByRole('list', { name: 'How integration works' })
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((step) => step.textContent),
    ).toEqual([
      '1Step 1: RequestA Domain Admin raises a formal integration request for a location.',
      '2Step 2: LinkThe location is mapped 1:1 to its EMR twin through a shared Unique Location ID.',
      '3Step 3: ElectIntegrated locations send sessions, charges, charts, cases and providers; EMR-only payloads are blocked.',
    ])

    const table = await locationsTable()
    const bayRidge = rowOf(table, 'Bay Ridge')
    expect(bayRidge).toHaveTextContent('EMR-LOC-4471')
    expect(bayRidge).toHaveTextContent(`Since ${formatIsoDate('2025-11-03')}`)
    expect(within(bayRidge).getByRole('button', { name: 'Switch to EMR-only' })).toBeVisible()
    const parkSlope = rowOf(table, 'Park Slope')
    expect(parkSlope).toHaveTextContent('Not linked')
    expect(within(parkSlope).getByRole('button', { name: 'Request integration' })).toBeVisible()
    const annex = rowOf(table, 'Staten Island Annex')
    expect(annex).toHaveTextContent(`By Ivy Bennett · ${formatIsoDate('2026-09-11')}`)
    expect(within(annex).getByRole('button', { name: 'Approve & link' })).toBeVisible()
    expect(
      screen.getByText('A System Admin or Organization Admin approves integration requests.'),
    ).toBeVisible()
    // Another practice's location is not listed.
    expect(within(table).queryByText('Northgate Main')).not.toBeInTheDocument()

    const log = await logTable()
    expect(within(log).getAllByRole('row')).toHaveLength(4) // header + this practice's 3
    expect(screen.getByText('3 payloads')).toBeVisible()
    expect(screen.queryByText(/backend|not saved|temporary|demo|coming soon|mock/i)).not.toBeInTheDocument()
  })

  it('says how far the locations are linked, in a quiet line under Locations', async () => {
    renderAt()
    await locationsTable()
    const locations = screen.getByRole('region', { name: 'Locations' })
    expect(within(locations).getByText(/of 3 locations linked/)).toHaveTextContent('1 of 3 locations linked')
    expect(within(locations).getByText(/integrated$/)).toHaveTextContent('1 integrated')
    expect(within(locations).getByText('1 awaiting approval')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Payload log' })).toBeInTheDocument()
  })

  it('switches practice from the header, kept in the URL', async () => {
    const router = renderAt()
    await locationsTable()
    await userEvent.click(screen.getByRole('combobox', { name: 'Practice' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Northgate Sports & Spine' }))
    const table = await locationsTable('Northgate Sports & Spine')
    expect(rowOf(table, 'Northgate Main')).toHaveTextContent('EMR-LOC-5120')
    expect(router.state.location.search).toEqual({ practice: 2 })
    expect(within(await logTable()).getByText('Northgate patient')).toBeInTheDocument()
  })

  it('opens the practice in the URL', async () => {
    renderAt('/admin/integration?practice=2')
    expect(rowOf(await locationsTable('Northgate Sports & Spine'), 'Northgate Main')).toBeInTheDocument()
  })

  it('filters the payload log by result, with counts', async () => {
    renderAt()
    await locationsTable()
    const pills = await screen.findByRole('group', { name: 'Filter by result' }, { timeout: 5000 })
    expect(
      within(pills)
        .getAllByRole('button')
        .map((pill) => pill.textContent),
    ).toEqual(['Accepted 1', 'Replaced 1', 'Updated queue 0', 'Blocked 1'])
    await userEvent.click(within(pills).getByRole('button', { name: 'Blocked 1' }))
    const log = await logTable()
    expect(within(log).getAllByRole('row')).toHaveLength(2)
    expect(within(log).getByText('Walk-in (Staten Island)')).toBeInTheDocument()

    await userEvent.click(within(pills).getByRole('button', { name: 'Blocked 1' }))
    await userEvent.click(within(pills).getByRole('button', { name: 'Updated queue 0' }))
    expect(await screen.findByText('No payloads')).toBeVisible()
    expect(
      screen.getByText('Payloads appear here when a linked location sends a finalized note.'),
    ).toBeVisible()
  })

  it('requests integration for a location: required, unique id, then Requested', async () => {
    renderAt()
    const table = await locationsTable()
    await userEvent.click(
      within(rowOf(table, 'Park Slope')).getByRole('button', { name: 'Request integration' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Request integration — Park Slope' })
    expect(
      within(dialog).getByText(
        'The shared Unique Location ID maps this location 1:1 to the same location in the EMR.',
      ),
    ).toBeVisible()
    const id = within(dialog).getByRole('textbox', { name: /unique location id/i })
    expect(id).toHaveAttribute('placeholder', 'Enter Unique Location ID')
    expect(within(dialog).getByRole('textbox', { name: /note for the approver/i })).not.toBeRequired()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }))
    expect(await within(dialog).findByText('Enter the Unique Location ID.')).toBeVisible()
    await userEvent.type(id, 'EMR-LOC-5120')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }))
    expect(await within(dialog).findByText('This ID is already linked to another location.')).toBeVisible()

    await userEvent.clear(id)
    await userEvent.type(id, 'EMR-LOC-4472')
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /note for the approver/i }),
      'Second site',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send request' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const parkSlope = rowOf(table, 'Park Slope')
    expect(parkSlope).toHaveTextContent('Requested')
    expect(parkSlope).toHaveTextContent('EMR-LOC-4472')
    // The signed-in person (the development session) asked, today.
    await waitFor(() =>
      expect(parkSlope).toHaveTextContent(`By Dana Whitfield · ${formatIsoDate(todayIso())}`),
    )
    expect(within(parkSlope).getByRole('button', { name: 'Approve & link' })).toBeVisible()
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        tone: 'success',
        title: 'Integration requested',
        description: 'It waits for approval before the location is linked.',
      }),
    ])
  })

  it('approves and links a requested location after asking; it stays EMR-only', async () => {
    renderAt()
    const table = await locationsTable()
    await userEvent.click(
      within(rowOf(table, 'Staten Island Annex')).getByRole('button', { name: 'Approve & link' }),
    )
    const confirm = screen.getByRole('alertdialog', { name: 'Link Staten Island Annex to the EMR?' })
    expect(
      within(confirm).getByText(
        'Unique Location ID EMR-LOC-4480 is mapped 1:1. The location stays EMR-only until someone elects it for billing.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Approve & link' }))

    const annex = rowOf(table, 'Staten Island Annex')
    await waitFor(() => expect(annex).toHaveTextContent(`Since ${formatIsoDate(todayIso())}`))
    expect(annex).toHaveTextContent('EMR only')
    expect(within(annex).getByRole('button', { name: 'Switch to integrated' })).toBeVisible()
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        title: 'Staten Island Annex linked',
        description: 'Switch it to Integrated to send its sessions into billing.',
      }),
    ])
  })

  it('switches the billing election after asking, and can be cancelled', async () => {
    renderAt()
    const table = await locationsTable()
    const bayRidge = () => rowOf(table, 'Bay Ridge')

    await userEvent.click(within(bayRidge()).getByRole('button', { name: 'Switch to EMR-only' }))
    let confirm = screen.getByRole('alertdialog', { name: 'Make Bay Ridge EMR-only?' })
    expect(
      within(confirm).getByText(
        'New payloads from this location are blocked from billing. Data already in billing is not changed.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(within(bayRidge()).getByRole('button', { name: 'Switch to EMR-only' })).toBeVisible()

    await userEvent.click(within(bayRidge()).getByRole('button', { name: 'Switch to EMR-only' }))
    confirm = screen.getByRole('alertdialog', { name: 'Make Bay Ridge EMR-only?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Switch to EMR-only' }))
    await waitFor(() =>
      expect(within(bayRidge()).getByRole('button', { name: 'Switch to integrated' })).toBeVisible(),
    )
    expect(useToastStore.getState().toasts.at(-1)).toEqual(
      expect.objectContaining({ title: 'Bay Ridge is now EMR only' }),
    )

    await userEvent.click(within(bayRidge()).getByRole('button', { name: 'Switch to integrated' }))
    confirm = screen.getByRole('alertdialog', { name: 'Bill Bay Ridge through the platform?' })
    expect(
      within(confirm).getByText(
        'From now on its sessions, charges, patient charts, cases and providers flow into billing.',
      ),
    ).toBeVisible()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Switch to integrated' }))
    await waitFor(() =>
      expect(within(bayRidge()).getByRole('button', { name: 'Switch to EMR-only' })).toBeVisible(),
    )
    expect(useToastStore.getState().toasts.at(-1)).toEqual(
      expect.objectContaining({ title: 'Bay Ridge is now Integrated' }),
    )
  })

  it('pages the payload log 10 at a time', async () => {
    resetEmrIntegration(
      [],
      Array.from({ length: 12 }, (_, index) => payload(index + 10, 1, 'Accepted')),
    )
    renderAt()
    expect(await screen.findByText('Showing 1–10 of 12 payloads', undefined, { timeout: 5000 })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(await screen.findByText('Showing 11–12 of 12 payloads')).toBeVisible()
  })

  it('says when there is no practice yet', async () => {
    practicesMock.mockReset().mockResolvedValue([])
    renderAt()
    expect(await screen.findByText('No practice yet', undefined, { timeout: 5000 })).toBeVisible()
  })
})
