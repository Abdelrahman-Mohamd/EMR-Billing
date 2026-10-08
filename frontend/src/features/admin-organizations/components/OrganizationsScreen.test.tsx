import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
} from '../api/organizations-api'
import type { Organization } from '../schemas/organization'

// Only the integration point is faked; the route, query hooks, table, dialog
// and form all run for real. `server` is what the fake backend holds, in its
// own order, and it pages it 15 at a time as the real one does.
vi.mock('../api/organizations-api', () => ({
  listOrganizations: vi.fn(),
  getOrganization: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
}))
const listMock = vi.mocked(listOrganizations)
const getMock = vi.mocked(getOrganization)
const createMock = vi.mocked(createOrganization)
const updateMock = vi.mocked(updateOrganization)
const deleteMock = vi.mocked(deleteOrganization)

const PER_PAGE = 15

const organization = (id: number, name: string, isActive = true, practicesCount = 0): Organization => ({
  id,
  name,
  isActive,
  practicesCount,
  createdAt: '2026-10-07T16:06:23.000000Z',
})

let server: Organization[]

beforeEach(() => {
  server = [
    organization(1, 'Harborline Rehab Group', true, 3),
    organization(2, 'Alder Therapy Partners', false, 0),
  ]
  listMock.mockReset().mockImplementation((page) => {
    const start = (page - 1) * PER_PAGE
    const slice = server.slice(start, start + PER_PAGE)
    return Promise.resolve({
      organizations: slice.map((o) => ({ ...o })),
      page,
      pageCount: Math.max(1, Math.ceil(server.length / PER_PAGE)),
      total: server.length,
      from: slice.length === 0 ? 0 : start + 1,
      to: start + slice.length,
    })
  })
  getMock.mockReset().mockImplementation((id) => {
    const found = server.find((o) => o.id === id)
    return found
      ? Promise.resolve({ id: found.id, name: found.name, isActive: found.isActive })
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  createMock.mockReset().mockImplementation((input) => {
    server = [...server, organization(server.length + 1, input.name, input.isActive)]
    // As the backend answers: its own message, no record.
    return Promise.resolve('Organization created successfully')
  })
  updateMock.mockReset().mockImplementation((id, input) => {
    server = server.map((o) => (o.id === id ? { ...o, name: input.name, isActive: input.isActive } : o))
    return Promise.resolve('Organization updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    server = server.filter((o) => o.id !== id)
    return Promise.resolve('Organization deleted successfully')
  })
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/organizations') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.getByRole('table', { name: 'Organizations' })
const nameInput = () => screen.getByRole('textbox', { name: /organization name/i })
const dialog = () => screen.getByRole('dialog')

async function openCreate() {
  await userEvent.click(await screen.findByRole('button', { name: 'New organization' }))
  return dialog()
}

async function openEdit(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }))
  const edit = dialog()
  await within(edit).findByRole('textbox', { name: /organization name/i })
  return edit
}

describe('Admin → Organizations', () => {
  it('lives under Admin, which opens on it, with a rail entry and a section list', async () => {
    const { router } = renderAt('/admin')
    // The first test pays for loading the route's code-split chunk; under a
    // full, parallel run the default one second is not always enough.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Organizations' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/organizations')

    const rail = screen.getByRole('navigation', { name: 'Main' })
    expect(within(rail).getByRole('link', { name: 'Admin' })).toHaveAttribute('data-status', 'active')
    // Only the module the screen belongs to is lit.
    expect(within(rail).getByRole('link', { name: 'Patients' })).not.toHaveAttribute('data-status', 'active')

    const sections = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(sections).getByRole('link', { name: 'Organizations' })).toHaveAttribute(
      'data-status',
      'active',
    )
  })

  it('lists organizations in the server order, with their practices, status and a count', async () => {
    renderAt()
    expect(await screen.findByText('Harborline Rehab Group', {}, { timeout: 5000 })).toBeInTheDocument()

    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Organization', 'Practices', 'Active', 'Actions'])
    const rows = within(table()).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Harborline Rehab Group',
      'Alder Therapy Partners',
    ])
    expect(within(rows[0] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('3')
    // The shared Active switch: off is Inactive, on is Active.
    expect(
      within(rows[0] as HTMLElement).getByRole('switch', { name: 'Harborline Rehab Group: active' }),
    ).toBeChecked()
    expect(
      within(rows[1] as HTMLElement).getByRole('switch', { name: 'Alder Therapy Partners: active' }),
    ).not.toBeChecked()
    expect(screen.getByText('2 organizations')).toBeInTheDocument()
    // No sort: the server's order is the order.
    expect(within(table()).queryByRole('button', { name: /^organization/i })).not.toBeInTheDocument()
  })

  it('pages as the server does, 15 at a time', async () => {
    server = Array.from({ length: 32 }, (_, index) => organization(index + 1, `Group ${index + 1}`))
    renderAt()
    expect(
      await screen.findByText('Showing 1–15 of 32 organizations', {}, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(listMock).toHaveBeenLastCalledWith(1, expect.anything())
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Showing 16–30 of 32 organizations')).toBeInTheDocument()
    expect(listMock).toHaveBeenLastCalledWith(2, expect.anything())
    expect(within(table()).getByText('Group 16')).toBeInTheDocument()
  })

  it('shows a loading state until the list arrives', async () => {
    listMock.mockImplementation(() => new Promise(() => {}))
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'Organizations' }, { timeout: 5000 })
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('explains an empty list and offers to create the first one', async () => {
    server = []
    renderAt()
    expect(await screen.findByText('No organizations', {}, { timeout: 5000 })).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'New organization' })
    await userEvent.click(buttons[buttons.length - 1] as HTMLElement)
    expect(within(dialog()).getByRole('heading', { name: 'New organization' })).toBeInTheDocument()
  })

  it('shows a failed load and retries it', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }, { timeout: 5000 }))
    expect(await screen.findByText('Harborline Rehab Group')).toBeInTheDocument()
  })

  it('creates an organization, refreshes the list and confirms it', async () => {
    renderAt()
    const create = await openCreate()
    expect(getMock).not.toHaveBeenCalled()
    expect(nameInput()).toHaveAttribute('placeholder', 'Enter the organization name')
    expect(within(create).getByRole('switch', { name: 'Active' })).toBeChecked()

    await userEvent.type(nameInput(), 'Cedar Valley Health')
    await userEvent.click(within(create).getByRole('button', { name: 'Create organization' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({ name: 'Cedar Valley Health', isActive: true })
    expect(await within(table()).findByText('Cedar Valley Health')).toBeInTheDocument()
    expect(screen.getByText('3 organizations')).toBeInTheDocument()
    // The server's message, not ours.
    expect(screen.getByRole('status')).toHaveTextContent('Organization created successfully')
  })

  it('requires a name, and a blank one is not a name', async () => {
    renderAt()
    const create = await openCreate()
    await userEvent.type(nameInput(), '   ')
    await userEvent.click(within(create).getByRole('button', { name: 'Create organization' }))

    expect(await within(create).findByText('Enter the organization name.')).toBeInTheDocument()
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput()).toHaveFocus()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('lets Enter in the name field submit, through the footer button that belongs to the form', async () => {
    renderAt()
    const create = await openCreate()
    // The button sits in the dialog footer, outside the <form>; its `form`
    // attribute makes it the form's default button, which is what a browser
    // presses on Enter. jsdom does not do implicit submission, so the link
    // itself is what is checked here.
    const submit = within(create).getByRole('button', { name: 'Create organization' })
    expect(submit).toHaveAttribute('type', 'submit')
    expect((submit as HTMLButtonElement).form).toBe((nameInput() as HTMLInputElement).form)
    expect((submit as HTMLButtonElement).form).not.toBeNull()
  })

  it('edits an organization as the server has it now, not as the row showed it', async () => {
    renderAt()
    await screen.findByText('Alder Therapy Partners', {}, { timeout: 5000 })
    // Renamed elsewhere since the list was loaded.
    server = server.map((o) => (o.id === 2 ? { ...o, name: 'Alder Therapy Partners LLC' } : o))
    const edit = await openEdit('Alder Therapy Partners')
    expect(getMock).toHaveBeenCalledWith(2, expect.anything())
    expect(nameInput()).toHaveValue('Alder Therapy Partners LLC')
    const active = within(edit).getByRole('switch', { name: 'Active' })
    expect(active).not.toBeChecked()

    await userEvent.click(active)
    await userEvent.click(within(edit).getByRole('button', { name: 'Save organization' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(2, { name: 'Alder Therapy Partners LLC', isActive: true })
    expect(screen.getByRole('status')).toHaveTextContent('Organization updated successfully')
    const row = (await within(table()).findByText('Alder Therapy Partners LLC')).closest('tr') as HTMLElement
    expect(within(row).getByRole('switch', { name: 'Alder Therapy Partners LLC: active' })).toBeChecked()
  })

  it('holds Save until the organization has loaded, and says so when it no longer exists', async () => {
    let answer: (value: { id: number; name: string; isActive: boolean }) => void = () => undefined
    getMock.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Harborline Rehab Group' }, { timeout: 5000 }),
    )
    expect(within(dialog()).getByRole('button', { name: 'Save organization' })).toBeDisabled()
    answer({ id: 1, name: 'Harborline Rehab Group', isActive: true })
    expect(await within(dialog()).findByRole('textbox', { name: /organization name/i })).toHaveValue(
      'Harborline Rehab Group',
    )
    expect(within(dialog()).getByRole('button', { name: 'Save organization' })).toBeEnabled()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    server = server.filter((o) => o.id !== 2)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Alder Therapy Partners' }))
    expect(await within(dialog()).findByText('This organization no longer exists')).toBeInTheDocument()
    expect(within(dialog()).getByRole('button', { name: 'Save organization' })).toBeDisabled()
  })

  it('asks before changing the status, and cancelling changes nothing', async () => {
    renderAt()
    const toggle = await screen.findByRole(
      'switch',
      { name: 'Alder Therapy Partners: active' },
      { timeout: 5000 },
    )
    await userEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog', { name: 'Reactivate Alder Therapy Partners?' })
    expect(ask).toHaveTextContent('Its status becomes Active again.')
    expect(toggle).not.toBeChecked()
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(updateMock).not.toHaveBeenCalled()
    expect(toggle).not.toBeChecked()
  })

  it('keeps the confirmation open until the server saves it, then shows the new status at once', async () => {
    let finish: (message: string | null) => void = () => undefined
    updateMock.mockImplementationOnce((id, input) => {
      server = server.map((o) => (o.id === id ? { ...o, isActive: input.isActive } : o))
      return new Promise((resolve) => (finish = resolve))
    })
    // The list is not read again in time: the switch must not wait for it.
    renderAt()
    const toggle = await screen.findByRole(
      'switch',
      { name: 'Harborline Rehab Group: active' },
      { timeout: 5000 },
    )
    await userEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog', { name: 'Deactivate Harborline Rehab Group?' })
    await userEvent.click(within(ask).getByRole('button', { name: 'Deactivate' }))
    // Saving: the dialog stays, its button busy; the switch has not moved.
    expect(updateMock).toHaveBeenCalledWith(1, { name: 'Harborline Rehab Group', isActive: false })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(toggle).toBeChecked()

    listMock.mockImplementation(() => new Promise(() => {}))
    finish('Organization updated successfully')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(toggle).not.toBeChecked()
    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ tone: 'success', title: 'Organization updated successfully' }),
    ])
  })

  it('leaves the switch as it was and gives the server reason when the save is refused', async () => {
    updateMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'An organization with practices cannot be deactivated.',
        serverMessage: 'An organization with practices cannot be deactivated.',
        status: 422,
      }),
    )
    renderAt()
    const toggle = await screen.findByRole(
      'switch',
      { name: 'Harborline Rehab Group: active' },
      { timeout: 5000 },
    )
    await userEvent.click(toggle)
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          tone: 'error',
          title: 'Harborline Rehab Group was not deactivated',
          description: 'An organization with practices cannot be deactivated.',
        }),
      ]),
    )
    expect(toggle).toBeChecked()
  })

  it('puts a duplicate-name rejection from the server on the name field', async () => {
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'name', message: 'An organization with this name already exists.' }],
      }),
    )
    renderAt()
    const create = await openCreate()
    await userEvent.type(nameInput(), 'Harborline Rehab Group')
    await userEvent.click(within(create).getByRole('button', { name: 'Create organization' }))

    expect(
      await within(create).findByText('An organization with this name already exists.'),
    ).toBeInTheDocument()
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(nameInput()).toHaveFocus())
    // On the field only, not repeated as a message at the top.
    expect(within(create).queryByText('Some fields need attention.')).not.toBeInTheDocument()
  })

  it('keeps the dialog and what was typed when saving fails', async () => {
    createMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    const create = await openCreate()
    await userEvent.type(nameInput(), 'Cedar Valley Health')
    await userEvent.click(within(create).getByRole('button', { name: 'Create organization' }))

    expect(await within(create).findByText(/not available right now/i)).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Cedar Valley Health')
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape without saving and returns focus to what opened it', async () => {
    renderAt()
    const opener = await screen.findByRole(
      'button',
      { name: 'Edit Harborline Rehab Group' },
      { timeout: 5000 },
    )
    await openEdit('Harborline Rehab Group')
    await userEvent.type(nameInput(), ' changed')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).not.toHaveBeenCalled()
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('deletes an organization after asking, and refreshes the list', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Harborline Rehab Group' }, { timeout: 5000 }),
    )
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Harborline Rehab Group?' })
    expect(ask).toHaveTextContent('It groups 3 practices.')
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete organization' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteMock).toHaveBeenCalledWith(1)
    await waitFor(() => expect(within(table()).queryByText('Harborline Rehab Group')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Organization deleted successfully')
    expect(screen.getByText('1 organization')).toBeInTheDocument()
  })

  it('does nothing when the delete is cancelled, and says so when the server refuses it', async () => {
    renderAt()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete Alder Therapy Partners' }, { timeout: 5000 }),
    )
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Alder Therapy Partners?' })
    // No practices: nothing to state.
    expect(ask).not.toHaveTextContent('It groups')
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteMock).not.toHaveBeenCalled()

    deleteMock.mockRejectedValueOnce(
      new ApiError({ kind: 'validation', message: 'This organization still has practices.', status: 422 }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete Alder Therapy Partners' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete organization' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          tone: 'error',
          title: 'Alder Therapy Partners was not deleted',
          description: 'This organization still has practices.',
        }),
      ]),
    )
    expect(within(table()).getByText('Alder Therapy Partners')).toBeInTheDocument()
  })

  it('says it in its own words when the server sends no message, and shows the server reason on a refusal', async () => {
    createMock.mockImplementationOnce((input) => {
      server = [...server, organization(server.length + 1, input.name, input.isActive)]
      return Promise.resolve(null)
    })
    renderAt()
    const create = await openCreate()
    await userEvent.type(nameInput(), 'Cedar Valley Health')
    await userEvent.click(within(create).getByRole('button', { name: 'Create organization' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Cedar Valley Health created')

    // A refusal that names a field the form does not have: the server's sentence, at the top.
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'Organizations are limited to 10.',
        serverMessage: 'Organizations are limited to 10.',
        status: 422,
        fieldErrors: [{ path: 'limit', message: 'Organizations are limited to 10.' }],
      }),
    )
    const again = await openCreate()
    await userEvent.type(nameInput(), 'Eleventh Group')
    await userEvent.click(within(again).getByRole('button', { name: 'Create organization' }))
    expect(await within(again).findByText('Organizations are limited to 10.')).toBeInTheDocument()
  })
})
