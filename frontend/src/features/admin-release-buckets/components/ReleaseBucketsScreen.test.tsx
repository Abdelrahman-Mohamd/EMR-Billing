import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import type { Practice } from '@/features/admin-practices'
import { createReleaseBucket, listReleaseBuckets, updateReleaseBucket } from '../api/release-buckets-api'
import type { ReleaseBucket } from '../schemas/release-bucket'

// Only the integration points are faked: this feature's api functions and the
// practices list the selector reads. Everything above them runs for real.
vi.mock('../api/release-buckets-api', () => ({
  listReleaseBuckets: vi.fn(),
  createReleaseBucket: vi.fn(),
  updateReleaseBucket: vi.fn(),
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
const listMock = vi.mocked(listReleaseBuckets)
const createMock = vi.mocked(createReleaseBucket)
const updateMock = vi.mocked(updateReleaseBucket)

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

let buckets: ReleaseBucket[]

beforeEach(() => {
  buckets = [
    {
      id: 2,
      practiceId: 1,
      name: 'Manual Release – WC Payers',
      description: 'Workers’ comp payers reviewed before sending.',
    },
    { id: 1, practiceId: 1, name: 'Manual Release – Auto / No-Fault', description: '' },
    { id: 4, practiceId: 3, name: 'Manual Release – Northgate', description: 'Northgate review.' },
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(buckets)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(3, 'Northgate Sports & Spine')])
  createMock.mockReset().mockImplementation((values) =>
    Promise.resolve({
      id: 9,
      practiceId: Number(values.practiceId),
      name: values.name,
      description: values.description,
    }),
  )
  updateMock.mockReset().mockImplementation((id, values) =>
    Promise.resolve({
      id,
      practiceId: Number(values.practiceId),
      name: values.name,
      description: values.description,
    }),
  )
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/setup/release-buckets') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.findByRole('table', { name: 'Release buckets' })
const field = (name: RegExp) => screen.getByRole('textbox', { name })

describe('Setup → Release buckets', () => {
  it('lists buckets by name with their description and practice — no status column', async () => {
    renderAt()
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Release buckets' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Setup' })).getByRole('link', {
        name: 'Release buckets',
      }),
    ).toHaveAttribute('data-status', 'active')
    await within(await table()).findByText('Manual Release – WC Payers')
    const rows = within(await table()).getAllByRole('row')
    // Sorted by name.
    expect(rows[1]).toHaveTextContent('Manual Release – Auto / No-Fault')
    expect(rows[2]).toHaveTextContent('Manual Release – Northgate')
    expect(await within(rows[2] as HTMLElement).findAllByText('Northgate Sports & Spine')).not.toHaveLength(0)
    expect(rows[3]).toHaveTextContent('Manual Release – WC Payers')
    expect(rows[3]).toHaveTextContent('Workers’ comp payers reviewed before sending.')
    expect(within(await table()).queryByRole('columnheader', { name: /status/i })).not.toBeInTheDocument()
    expect(screen.getByText('3 release buckets')).toBeInTheDocument()
  })

  it('filters to one practice from the URL', async () => {
    renderAt('/setup/release-buckets?practice=3')
    const rows = within(await table()).getAllByRole('row')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toHaveTextContent('Manual Release – Northgate')
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(within(await table()).getByText('Manual Release – WC Payers')).toBeInTheDocument()
  })

  it('explains an empty list and offers to add the first bucket', async () => {
    buckets = []
    renderAt()
    expect(await screen.findByText('No release buckets yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add a release bucket' }))
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { name: 'New release bucket' }),
    ).toBeInTheDocument()
  })

  it('refuses a bucket without a practice or a name', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'New release bucket' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save bucket' }))
    expect(await within(dialog).findByText('Select a practice.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter the bucket name.')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('adds a bucket to the practice the user picks — none is chosen for them', async () => {
    // Even with the list filtered, the new bucket's practice starts empty.
    renderAt('/setup/release-buckets?practice=1')
    await userEvent.click(await screen.findByRole('button', { name: 'New release bucket' }))
    const dialog = screen.getByRole('dialog')
    const practiceControl = within(dialog).getByRole('combobox', { name: /^practice/i })
    expect(practiceControl).toHaveTextContent('Select a practice')
    expect(field(/^name/i)).toHaveAttribute('placeholder', 'Enter release bucket name')
    expect(field(/^description/i)).toHaveAttribute('placeholder', 'Describe when this release bucket is used')

    await waitFor(() => expect(practiceControl).not.toHaveAttribute('aria-disabled', 'true'))
    await userEvent.click(practiceControl)
    await userEvent.click(await screen.findByRole('option', { name: /Northgate Sports & Spine/ }))
    await userEvent.type(field(/^name/i), 'Manual Release – WC Payers')
    await userEvent.type(field(/^description/i), "Workers' comp payers reviewed before sending")
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save bucket' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({
      practiceId: '3',
      name: 'Manual Release – WC Payers',
      description: "Workers' comp payers reviewed before sending",
    })
    expect(await screen.findByText('Release bucket saved')).toBeInTheDocument()
  }, 15_000)

  it('edits a bucket with its values filled in and its practice kept', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Manual Release – WC Payers' }))
    const dialog = screen.getByRole('dialog')
    const practiceControl = within(dialog).getByRole('combobox', { name: /^practice/i })
    expect(practiceControl).toHaveAttribute('aria-disabled', 'true')
    await waitFor(() => expect(practiceControl).toHaveTextContent('Harborline Physical Therapy'))
    expect(field(/^name/i)).toHaveValue('Manual Release – WC Payers')
    await userEvent.clear(field(/^description/i))
    await userEvent.type(field(/^description/i), 'Reviewed by the WC team.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save bucket' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(2, {
      practiceId: '1',
      name: 'Manual Release – WC Payers',
      description: 'Reviewed by the WC team.',
    })
  })

  it('puts a server’s field error on the field, and keeps the dialog when saving fails', async () => {
    updateMock
      .mockRejectedValueOnce(
        new ApiError({
          kind: 'validation',
          message: 'Some fields need attention.',
          fieldErrors: [{ path: 'name', message: 'This name is already used in this practice.' }],
        }),
      )
      .mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Manual Release – WC Payers' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save bucket' }))
    expect(await screen.findByText('This name is already used in this practice.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save bucket' }))
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
