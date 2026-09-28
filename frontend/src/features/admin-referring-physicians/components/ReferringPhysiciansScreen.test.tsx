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
  createReferringPhysician,
  listReferringPhysicians,
  updateReferringPhysician,
} from '../api/referring-physicians-api'
import type { ReferringPhysician } from '../schemas/referring-physician'

// Only the integration points are faked: this feature's api functions and the
// practices list the selector reads. Everything above them runs for real.
vi.mock('../api/referring-physicians-api', () => ({
  listReferringPhysicians: vi.fn(),
  createReferringPhysician: vi.fn(),
  updateReferringPhysician: vi.fn(),
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
const listMock = vi.mocked(listReferringPhysicians)
const createMock = vi.mocked(createReferringPhysician)
const updateMock = vi.mocked(updateReferringPhysician)

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

let physicians: ReferringPhysician[]

beforeEach(() => {
  physicians = [
    { id: 1, practiceId: 1, code: 'TB02', name: 'Thomas Beckett, MD', type: 'DN', npi: '1831405962' },
    { id: 2, practiceId: 1, code: 'RS06', name: 'Rebecca Stone, MD', type: 'DQ', npi: '1164738295' },
    { id: 3, practiceId: 2, code: 'SO01', name: 'Samuel Ortiz, MD', type: 'DN', npi: '9999999999' },
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(physicians)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate Sports & Spine')])
  createMock.mockReset().mockImplementation((values) => {
    const created = {
      id: 9,
      practiceId: Number(values.practiceId),
      code: values.code,
      name: values.name,
      type: values.type ?? '',
      npi: values.npi,
    }
    physicians = [...physicians, created]
    return Promise.resolve(created)
  })
  updateMock.mockReset().mockImplementation((id, values) =>
    Promise.resolve({
      id,
      practiceId: Number(values.practiceId),
      code: values.code,
      name: values.name,
      type: values.type ?? '',
      npi: values.npi,
    }),
  )
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/referring-physicians') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.findByRole('table', { name: 'Referring physicians' })
const field = (name: RegExp) => screen.getByRole('textbox', { name })

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New physician' }))
  return screen.getByRole('dialog')
}

async function choose(dialog: HTMLElement, combobox: RegExp, option: RegExp) {
  const control = within(dialog).getByRole('combobox', { name: combobox })
  await waitFor(() => expect(control).not.toHaveAttribute('aria-disabled', 'true'))
  await userEvent.click(control)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('Admin → Referring physicians', () => {
  it('lists every practice’s physicians by name, with code, type, NPI and practice', async () => {
    renderAt()
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Referring physicians' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const sections = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(sections).getByRole('link', { name: 'Referring physicians' })).toHaveAttribute(
      'data-status',
      'active',
    )

    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      expect.stringContaining('Rebecca Stone, MD'),
      expect.stringContaining('Samuel Ortiz, MD'),
      expect.stringContaining('Thomas Beckett, MD'),
    ])
    const stone = rows[0] as HTMLElement
    expect(stone).toHaveTextContent('RS06')
    expect(stone).toHaveTextContent('DQ · Supervising')
    expect(await within(stone).findByText('Harborline Physical Therapy')).toBeInTheDocument()
    // A dummy NPI is marked, as the prototype marks it.
    // (Twice in the DOM: in the NPI column, and under the name for phones, where
    // that column is hidden. CSS shows one at a time; jsdom renders both.)
    expect(within(rows[1] as HTMLElement).getAllByText('Invalid NPI').length).toBeGreaterThan(0)
    expect(screen.getByText('3 physicians')).toBeInTheDocument()
  })

  it('filters by practice, keeps the filter in the address, and resets it', async () => {
    const { router } = renderAt()
    await table()
    const filter = screen.getByRole('combobox', { name: 'Filter by practice' })
    await waitFor(() => expect(filter).not.toHaveAttribute('aria-disabled', 'true'))
    await userEvent.click(filter)
    await userEvent.click(await screen.findByRole('option', { name: 'Northgate Sports & Spine' }))

    await waitFor(() => expect(router.state.location.search).toEqual({ practice: 2 }))
    expect(screen.getByText('1 physician')).toBeInTheDocument()
    expect(within(await table()).queryByText('Thomas Beckett, MD')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(screen.getByText('3 physicians')).toBeInTheDocument()
  })

  it('shows a loading state, then a failed load with a retry', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(within(await table()).getByText('Thomas Beckett, MD')).toBeInTheDocument()
  })

  it('explains an empty directory and offers to add the first physician', async () => {
    physicians = []
    renderAt()
    expect(await screen.findByText('No referring physicians yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add a physician' }))
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { name: 'New referring physician' }),
    ).toBeInTheDocument()
  })

  it('adds a physician to the chosen practice and sends exactly what was entered', async () => {
    renderAt()
    const dialog = await openNew()
    expect(field(/^name/i)).toHaveAttribute('placeholder', 'Enter physician name')
    expect(field(/^code/i)).toHaveAttribute('placeholder', 'Enter physician code')
    expect(field(/^npi/i)).toHaveAttribute('placeholder', 'Enter NPI')
    // DN is the prototype's default type; no taxonomy field exists.
    expect(within(dialog).getByRole('combobox', { name: /^type/i })).toHaveTextContent('Referring (DN)')
    expect(within(dialog).queryByRole('textbox', { name: /taxonomy/i })).not.toBeInTheDocument()

    await choose(dialog, /^practice/i, /Northgate Sports & Spine/)
    await userEvent.type(field(/^name/i), 'Ada Lin, MD')
    await userEvent.type(field(/^code/i), 'AL07')
    await choose(dialog, /^type/i, /Supervising \(DQ\)/)
    await userEvent.type(field(/^npi/i), '1386950417')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save physician' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({
      practiceId: '2',
      code: 'AL07',
      name: 'Ada Lin, MD',
      type: 'DQ',
      npi: '1386950417',
    })
    expect(screen.getByRole('status')).toHaveTextContent('Physician saved')
    expect(within(await table()).getByText('Ada Lin, MD')).toBeInTheDocument()
  })

  it('pre-selects the practice the list is filtered to', async () => {
    renderAt('/admin/referring-physicians?practice=1')
    await table()
    const dialog = await openNew()
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: /^practice/i })).toHaveTextContent(
        'Harborline Physical Therapy',
      ),
    )
  })

  it('asks for every field and refuses an invalid or dummy NPI', async () => {
    renderAt()
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save physician' }))
    for (const message of [
      'Select a practice.',
      'Enter the physician name.',
      'Enter the code.',
      'Enter the NPI.',
    ]) {
      expect(await within(dialog).findByText(message)).toBeInTheDocument()
    }

    await userEvent.type(field(/^npi/i), '9999999999')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save physician' }))
    expect(await within(dialog).findByText('Please enter a valid NPI.')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('explains fields from info icons beside their labels', async () => {
    renderAt()
    const dialog = await openNew()
    expect(within(dialog).getByRole('button', { name: 'About Type' })).toHaveAccessibleDescription(/Box 17/)
    expect(within(dialog).getByRole('button', { name: 'About Code' })).toHaveAccessibleDescription(
      /No two physicians of a practice can share one/,
    )
    expect(field(/^code/i)).toHaveAccessibleName('Code')
  })

  it('puts a duplicate code rejected by the server on the code field', async () => {
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'code', message: 'This code is already used in this practice.' }],
      }),
    )
    renderAt('/admin/referring-physicians?practice=1')
    await table()
    const dialog = await openNew()
    await userEvent.type(field(/^name/i), 'Ada Lin, MD')
    await userEvent.type(field(/^code/i), 'TB02')
    await userEvent.type(field(/^npi/i), '1386950417')
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: /^practice/i })).toHaveTextContent(
        'Harborline Physical Therapy',
      ),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save physician' }))
    expect(await within(dialog).findByText('This code is already used in this practice.')).toBeInTheDocument()
    await waitFor(() => expect(field(/^code/i)).toHaveFocus())
  })

  it('edits a physician from the row, with the practice shown but fixed', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Thomas Beckett, MD' }))
    const dialog = screen.getByRole('dialog')
    expect(field(/^name/i)).toHaveValue('Thomas Beckett, MD')
    expect(field(/^code/i)).toHaveValue('TB02')
    const practiceControl = within(dialog).getByRole('combobox', { name: /^practice/i })
    await waitFor(() => expect(practiceControl).toHaveTextContent('Harborline Physical Therapy'))
    expect(practiceControl).toHaveAttribute('aria-disabled', 'true')

    await userEvent.clear(field(/^npi/i))
    await userEvent.type(field(/^npi/i), '1497061528')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save physician' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(1, {
      practiceId: '1',
      code: 'TB02',
      name: 'Thomas Beckett, MD',
      type: 'DN',
      npi: '1497061528',
    })
  })

  it('keeps the dialog and what was typed when saving fails', async () => {
    updateMock.mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Thomas Beckett, MD' }))
    await userEvent.clear(field(/^name/i))
    await userEvent.type(field(/^name/i), 'Tom Beckett, MD')
    await userEvent.click(screen.getByRole('button', { name: 'Save physician' }))
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument()
    expect(field(/^name/i)).toHaveValue('Tom Beckett, MD')
  })
})
