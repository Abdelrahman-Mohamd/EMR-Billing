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
  deleteReferringPhysician,
  getReferringPhysician,
  listReferringPhysicians,
  setReferringPhysicianActive,
  updateReferringPhysician,
} from '../api/referring-physicians-api'
import type { ReferringPhysician } from '../schemas/referring-physician'

// Only the integration points are faked: this feature's api functions and the
// practices list the selector reads. Everything above them runs for real.
vi.mock('../api/referring-physicians-api', () => ({
  listReferringPhysicians: vi.fn(),
  getReferringPhysician: vi.fn(),
  createReferringPhysician: vi.fn(),
  updateReferringPhysician: vi.fn(),
  setReferringPhysicianActive: vi.fn(),
  deleteReferringPhysician: vi.fn(),
  correctReferringPhysicianNpi: vi.fn(),
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
const getMock = vi.mocked(getReferringPhysician)
const setActiveMock = vi.mocked(setReferringPhysicianActive)
const deleteMock = vi.mocked(deleteReferringPhysician)

const physician = (
  id: number,
  practiceId: number,
  code: string,
  name: string,
  type: 'DN' | 'DQ',
  npi: string,
  overrides: Partial<ReferringPhysician> = {},
): ReferringPhysician => ({
  id,
  practiceId,
  code,
  name,
  type,
  typeLabel: type === 'DQ' ? 'Supervising' : 'Referring',
  npi,
  phone: '',
  fax: '',
  isActive: true,
  ...overrides,
})

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
    physician(1, 1, 'TB02', 'Thomas Beckett, MD', 'DN', '1831405962', {
      phone: '8005550199',
      fax: '8005550100',
    }),
    physician(2, 1, 'RS06', 'Rebecca Stone, MD', 'DQ', '1164738295'),
    physician(3, 2, 'SO01', 'Samuel Ortiz, MD', 'DN', '9999999999', { isActive: false }),
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(physicians)))
  practicesMock
    .mockReset()
    .mockResolvedValue([practice(1, 'Harborline Physical Therapy'), practice(2, 'Northgate Sports & Spine')])
  getMock.mockReset().mockImplementation((id) => {
    const found = physicians.find((item) => item.id === id)
    return found
      ? Promise.resolve(structuredClone(found))
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  // As the backend answers: its own message, no record.
  createMock.mockReset().mockImplementation((values) => {
    physicians = [
      ...physicians,
      physician(
        9,
        Number(values.practiceId),
        values.code,
        values.name,
        values.type === 'DQ' ? 'DQ' : 'DN',
        values.npi,
      ),
    ]
    return Promise.resolve('Referring physician created successfully')
  })
  updateMock.mockReset().mockResolvedValue('Referring physician updated successfully')
  setActiveMock.mockReset().mockImplementation((id, isActive) => {
    physicians = physicians.map((item) => (item.id === id ? { ...item, isActive } : item))
    return Promise.resolve('Referring physician updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    physicians = physicians.filter((item) => item.id !== id)
    return Promise.resolve('Referring physician deleted successfully')
  })
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/setup/referring-physicians') {
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

describe('Setup → Referring physicians', () => {
  it('is under Setup now; an old Admin link, with its filter, lands there', async () => {
    const { router } = renderAt('/admin/referring-physicians?practice=2')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Referring physicians' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/setup/referring-physicians')
    expect(router.state.location.search).toEqual({ practice: 2 })
  })

  it('lists every practice’s physicians by name, with code, type, NPI, phone · fax, practice and status', async () => {
    renderAt()
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Referring physicians' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const sections = screen.getByRole('navigation', { name: 'Setup' })
    expect(within(sections).getByRole('link', { name: 'Referring physicians' })).toHaveAttribute(
      'data-status',
      'active',
    )

    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    // In the server's order: nothing is sorted in the browser.
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      expect.stringContaining('Thomas Beckett, MD'),
      expect.stringContaining('Rebecca Stone, MD'),
      expect.stringContaining('Samuel Ortiz, MD'),
    ])
    const stone = rows[1] as HTMLElement
    expect(stone).toHaveTextContent('RS06')
    expect(stone).toHaveTextContent('DQ · Supervising')
    expect(await within(stone).findByText('Harborline Physical Therapy')).toBeInTheDocument()
    // A dummy NPI is marked, as the prototype marks it.
    // (Twice in the DOM: in the NPI column, and under the name for phones, where
    // that column is hidden. CSS shows one at a time; jsdom renders both.)
    expect(within(rows[2] as HTMLElement).getAllByText('Invalid NPI').length).toBeGreaterThan(0)
    expect(screen.getByText('3 physicians')).toBeInTheDocument()
    // Phone and fax, as the prototype shows them; the Cases count is not in the contract.
    const beckett = rows[0] as HTMLElement
    expect(beckett).toHaveTextContent('800-555-0199')
    expect(beckett).toHaveTextContent('Fax 800-555-0100')
    expect(
      within(await table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).not.toContain('Cases')
    expect(within(rows[2] as HTMLElement).getByRole('switch', { name: /: active$/ })).not.toBeChecked()
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
    await userEvent.type(field(/^phone/i), '(800) 555-0199')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save physician' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({
      practiceId: '2',
      code: 'AL07',
      name: 'Ada Lin, MD',
      type: 'DQ',
      npi: '1386950417',
      phone: '(800) 555-0199',
      fax: '',
      isActive: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent('Referring physician created successfully')
    expect(within(await table()).getByText('Ada Lin, MD')).toBeInTheDocument()
  })

  it('pre-selects the practice the list is filtered to', async () => {
    renderAt('/setup/referring-physicians?practice=1')
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
    renderAt('/setup/referring-physicians?practice=1')
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
    await within(dialog).findByRole('textbox', { name: /^name/i })
    expect(getMock).toHaveBeenCalledWith(1, expect.anything())
    expect(field(/^name/i)).toHaveValue('Thomas Beckett, MD')
    expect(field(/^phone/i)).toHaveValue('800-555-0199')
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
      phone: '800-555-0199',
      fax: '800-555-0100',
      isActive: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent('Referring physician updated successfully')
  })

  it('keeps the dialog and what was typed when saving fails', async () => {
    updateMock.mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Thomas Beckett, MD' }))
    await within(screen.getByRole('dialog')).findByRole('textbox', { name: /^name/i })
    await userEvent.clear(field(/^name/i))
    await userEvent.type(field(/^name/i), 'Tom Beckett, MD')
    await userEvent.click(screen.getByRole('button', { name: 'Save physician' }))
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument()
    expect(field(/^name/i)).toHaveValue('Tom Beckett, MD')
  })

  it('refuses a phone or fax that is not ten digits', async () => {
    renderAt()
    const dialog = await openNew()
    await userEvent.type(field(/^phone/i), '555-0199')
    await userEvent.type(field(/^fax/i), '12')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save physician' }))
    expect(await within(dialog).findByText('Enter a 10-digit phone number.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a 10-digit fax number.')).toBeInTheDocument()
  })

  it('changes a physician status with the Active switch, after asking', async () => {
    renderAt()
    const toggle = await screen.findByRole('switch', { name: 'Samuel Ortiz, MD: active' }, { timeout: 5000 })
    await userEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog', { name: 'Reactivate Samuel Ortiz, MD?' })
    expect(setActiveMock).not.toHaveBeenCalled()
    await userEvent.click(within(ask).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(setActiveMock).toHaveBeenCalledWith(3, true)
    expect(toggle).toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('Referring physician updated successfully')
  })

  it('deletes a physician after asking, and says why when the server refuses', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Rebecca Stone, MD' }, { timeout: 5000 }),
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete Rebecca Stone, MD?' })).getByRole(
        'button',
        {
          name: 'Delete physician',
        },
      ),
    )
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(2))
    expect(await screen.findByText('Referring physician deleted successfully')).toBeInTheDocument()

    deleteMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'This physician is used by cases.',
        serverMessage: 'This physician is used by cases.',
        status: 422,
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete Thomas Beckett, MD' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete physician' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts.at(-1)).toEqual(
        expect.objectContaining({
          tone: 'error',
          title: 'Thomas Beckett, MD was not deleted',
          description: 'This physician is used by cases.',
        }),
      ),
    )
  }, 15_000)
})
