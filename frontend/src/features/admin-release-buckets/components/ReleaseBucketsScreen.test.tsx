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
  createReleaseBucket,
  deleteReleaseBucket,
  getReleaseBucket,
  listReleaseBuckets,
  setReleaseBucketActive,
  updateReleaseBucket,
} from '../api/release-buckets-api'
import type { ReleaseBucket } from '../schemas/release-bucket'

// Only the integration points are faked: this feature's api functions and the
// practices list the selector reads. Everything above them runs for real.
vi.mock('../api/release-buckets-api', () => ({
  listReleaseBuckets: vi.fn(),
  getReleaseBucket: vi.fn(),
  createReleaseBucket: vi.fn(),
  updateReleaseBucket: vi.fn(),
  setReleaseBucketActive: vi.fn(),
  deleteReleaseBucket: vi.fn(),
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
const getMock = vi.mocked(getReleaseBucket)
const setActiveMock = vi.mocked(setReleaseBucketActive)
const deleteMock = vi.mocked(deleteReleaseBucket)

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
      isActive: true,
      insurancesCount: 3,
    },
    {
      id: 1,
      practiceId: 1,
      name: 'Manual Release – Auto / No-Fault',
      description: '',
      isActive: false,
      insurancesCount: 0,
    },
    {
      id: 4,
      practiceId: 3,
      name: 'Manual Release – Northgate',
      description: 'Northgate review.',
      isActive: true,
      insurancesCount: 1,
    },
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(buckets)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(3, 'Northgate Sports & Spine')])
  getMock.mockReset().mockImplementation((id) => {
    const found = buckets.find((bucket) => bucket.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  // As the backend answers: its own message, no record.
  createMock.mockReset().mockResolvedValue('Release bucket created successfully')
  updateMock.mockReset().mockResolvedValue('Release bucket updated successfully')
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    buckets = buckets.map((bucket) => (bucket.id === id ? { ...bucket, isActive } : bucket))
    return Promise.resolve('Release bucket updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    buckets = buckets.filter((bucket) => bucket.id !== id)
    return Promise.resolve('Release bucket deleted successfully')
  })
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
  it('lists buckets by name with their description, practice, insurance count and status', async () => {
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
    // Only what the backend sends: no held-insurance names, no claims waiting.
    expect(
      within(await table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Bucket', 'Practice', 'Insurances', 'Active', 'Actions'])
    expect(within(rows[3] as HTMLElement).getAllByRole('cell')[2]).toHaveTextContent('3')
    expect(within(rows[1] as HTMLElement).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
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
      isActive: true,
    })
    expect(await screen.findByText('Release bucket created successfully')).toBeInTheDocument()
  }, 15_000)

  it('edits a bucket with its values filled in and its practice kept', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Manual Release – WC Payers' }))
    const dialog = screen.getByRole('dialog')
    await within(dialog).findByRole('textbox', { name: /^name/i })
    expect(getMock).toHaveBeenCalledWith(2, expect.anything())
    expect(within(dialog).getByText('3 insurances are assigned to this bucket.')).toBeInTheDocument()
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
      isActive: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent('Release bucket updated successfully')
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
    await within(screen.getByRole('dialog')).findByRole('textbox', { name: /^name/i })
    await userEvent.click(screen.getByRole('button', { name: 'Save bucket' }))
    expect(await screen.findByText('This name is already used in this practice.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save bucket' }))
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('changes a bucket status with its switch, after asking', async () => {
    renderAt()
    await within(await table()).findByText('Manual Release – Auto / No-Fault')
    const toggle = screen.getByRole('switch', { name: 'Manual Release – Auto / No-Fault: active' })
    await userEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog', {
      name: 'Reactivate Manual Release – Auto / No-Fault?',
    })
    expect(setActiveMock).not.toHaveBeenCalled()
    await userEvent.click(within(ask).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(setActiveMock).toHaveBeenCalledWith(1, true)
    expect(toggle).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('Release bucket updated successfully')
  })

  it('deletes a bucket after asking, saying how many insurances are assigned to it', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Manual Release – WC Payers' }, { timeout: 5000 }),
    )
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Manual Release – WC Payers?' })
    expect(ask).toHaveTextContent('3 insurances are assigned to it.')
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete bucket' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteMock).toHaveBeenCalledWith(2)
    expect(screen.getByRole('status')).toHaveTextContent('Release bucket deleted successfully')
    await waitFor(async () =>
      expect(within(await table()).queryByText('Manual Release – WC Payers')).not.toBeInTheDocument(),
    )
  })

  it('says why when a delete is refused', async () => {
    deleteMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This bucket still has insurances.',
        serverMessage: 'This bucket still has insurances.',
        status: 422,
      }),
    )
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Manual Release – Northgate' }, { timeout: 5000 }),
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete bucket' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          tone: 'error',
          title: 'Manual Release – Northgate was not deleted',
          description: 'This bucket still has insurances.',
        }),
      ]),
    )
  })
})
