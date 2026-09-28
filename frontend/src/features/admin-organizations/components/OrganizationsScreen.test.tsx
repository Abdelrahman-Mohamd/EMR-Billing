import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { createOrganization, listOrganizations, updateOrganization } from '../api/organizations-api'
import type { Organization } from '../schemas/organization'

// Only the integration point is faked; the route, query hooks, table, dialog
// and form all run for real. `server` is what the fake backend holds.
vi.mock('../api/organizations-api', () => ({
  listOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
}))
const listMock = vi.mocked(listOrganizations)
const createMock = vi.mocked(createOrganization)
const updateMock = vi.mocked(updateOrganization)

let server: Organization[]

beforeEach(() => {
  server = [
    { id: 1, name: 'Harborline Rehab Group', isActive: true },
    { id: 2, name: 'Alder Therapy Partners', isActive: false },
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(server.map((o) => ({ ...o }))))
  createMock.mockReset().mockImplementation((input) => {
    const created = { id: server.length + 1, name: input.name, isActive: input.isActive }
    server = [...server, created]
    return Promise.resolve(created)
  })
  updateMock.mockReset().mockImplementation((id, input) => {
    const updated = { id, name: input.name, isActive: input.isActive }
    server = server.map((o) => (o.id === id ? updated : o))
    return Promise.resolve(updated)
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
    // Home is not lit just because every path starts with "/".
    expect(within(rail).getByRole('link', { name: 'Home' })).not.toHaveAttribute('data-status', 'active')

    const sections = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(sections).getByRole('link', { name: 'Organizations' })).toHaveAttribute(
      'data-status',
      'active',
    )
  })

  it('lists organizations by name with their status and a count', async () => {
    renderAt()
    expect(await screen.findByText('Harborline Rehab Group')).toBeInTheDocument()

    const rows = within(table()).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Alder Therapy Partners',
      'Harborline Rehab Group',
    ])
    expect(within(rows[0] as HTMLElement).getByText('Inactive')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('2 organizations')).toBeInTheDocument()
  })

  it('reverses the order from the Organization column header', async () => {
    renderAt()
    await screen.findByText('Harborline Rehab Group')
    await userEvent.click(within(table()).getByRole('button', { name: /organization/i }))

    const first = within(table()).getAllByRole('row')[1] as HTMLElement
    expect(within(first).getByText('Harborline Rehab Group')).toBeInTheDocument()
  })

  it('shows a loading state until the list arrives', async () => {
    listMock.mockImplementation(() => new Promise(() => {}))
    renderAt()
    await screen.findByRole('heading', { level: 1, name: 'Organizations' })
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('explains an empty list and offers to create the first one', async () => {
    server = []
    renderAt()
    expect(await screen.findByText('No organizations')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'New organization' })
    await userEvent.click(buttons[buttons.length - 1] as HTMLElement)
    expect(within(dialog()).getByRole('heading', { name: 'New organization' })).toBeInTheDocument()
  })

  it('shows a failed load and retries it', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await screen.findByText('Harborline Rehab Group')).toBeInTheDocument()
  })

  it('creates an organization, refreshes the list and confirms it', async () => {
    renderAt()
    const create = await openCreate()
    expect(nameInput()).toHaveAttribute('placeholder', 'Enter the organization name')
    expect(within(create).getByRole('switch', { name: 'Active' })).toBeChecked()

    await userEvent.type(nameInput(), 'Cedar Valley Health')
    await userEvent.click(within(create).getByRole('button', { name: 'Create organization' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({ name: 'Cedar Valley Health', isActive: true })
    expect(within(table()).getByText('Cedar Valley Health')).toBeInTheDocument()
    expect(screen.getByText('3 organizations')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cedar Valley Health created')
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

  it('edits an organization from its row', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Alder Therapy Partners' }))

    const edit = dialog()
    expect(within(edit).getByRole('heading', { name: 'Alder Therapy Partners' })).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Alder Therapy Partners')
    const active = within(edit).getByRole('switch', { name: 'Active' })
    expect(active).not.toBeChecked()

    await userEvent.click(active)
    await userEvent.click(within(edit).getByRole('button', { name: 'Save organization' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(2, { name: 'Alder Therapy Partners', isActive: true })
    expect(screen.getByRole('status')).toHaveTextContent('Organization saved')
    const row = within(table()).getByText('Alder Therapy Partners').closest('tr') as HTMLElement
    expect(within(row).getByText('Active')).toBeInTheDocument()
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
    const opener = await screen.findByRole('button', { name: 'Edit Harborline Rehab Group' })
    await userEvent.click(opener)
    await userEvent.type(nameInput(), ' changed')
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).not.toHaveBeenCalled()
    await waitFor(() => expect(opener).toHaveFocus())
  })
})
