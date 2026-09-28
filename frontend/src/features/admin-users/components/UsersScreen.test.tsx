import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { createUser, listUsers, updateUser } from '../api/users-api'
import type { User } from '../schemas/user'

// Only the integration point is faked; route, queries, table, dialogs and
// forms run for real.
vi.mock('../api/users-api', () => ({ listUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn() }))
const listMock = vi.mocked(listUsers)
const createMock = vi.mocked(createUser)
const updateMock = vi.mocked(updateUser)

const SECRET = 'Tr1cky-S3cret'

let users: User[]

beforeEach(() => {
  users = [
    { id: 1, name: 'Marcus Reyes', email: 'm.reyes@example.test', isActive: true },
    { id: 2, name: 'Dana Whitfield', email: 'd.whitfield@example.test', isActive: true },
    { id: 3, name: 'Owen Park', email: 'o.park@example.test', isActive: false },
  ]
  listMock.mockReset().mockImplementation(() => Promise.resolve(structuredClone(users)))
  createMock.mockReset().mockImplementation((values) => {
    const created = { id: 9, name: values.name, email: values.email, isActive: values.isActive }
    users = [...users, created]
    return Promise.resolve(created)
  })
  updateMock.mockReset().mockImplementation((id, values) => {
    const updated = { id, name: values.name, email: values.email, isActive: values.isActive }
    users = users.map((user) => (user.id === id ? updated : user))
    return Promise.resolve(updated)
  })
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderAt(path = '/admin/users') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const table = () => screen.findByRole('table', { name: 'Users' })
const field = (name: RegExp) => screen.getByRole('textbox', { name })
const passwordField = () => screen.getByLabelText(/^password/i)

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New user' }))
  return screen.getByRole('dialog')
}

async function fillNew(dialog: HTMLElement) {
  await userEvent.type(field(/^name/i), 'Ada Lin')
  await userEvent.type(field(/^email/i), 'ada@example.test')
  await userEvent.type(passwordField(), SECRET)
  return dialog
}

describe('Admin → Users', () => {
  it('lists users by name with email and status, under Admin', async () => {
    renderAt()
    // The first test pays for loading the route's code-split chunk.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Users' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    const sections = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(sections).getByRole('link', { name: 'Users' })).toHaveAttribute('data-status', 'active')

    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      expect.stringContaining('Dana Whitfield'),
      expect.stringContaining('Marcus Reyes'),
      expect.stringContaining('Owen Park'),
    ])
    expect(within(rows[0] as HTMLElement).getAllByText('d.whitfield@example.test').length).toBeGreaterThan(0)
    expect(within(rows[0] as HTMLElement).getByText('Active')).toBeInTheDocument()
    expect(within(rows[2] as HTMLElement).getByText('Inactive')).toBeInTheDocument()
    // No password column, and nothing password-like in the table.
    expect(within(await table()).queryByText(/password/i)).not.toBeInTheDocument()
    expect(screen.getByText('3 users')).toBeInTheDocument()
  })

  it('shows a loading state, a failed load with a retry, and an empty list', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    users = []
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await screen.findByText('No users yet')).toBeInTheDocument()
  })

  it('creates a user with exactly the entered values, starting active', async () => {
    renderAt()
    const dialog = await openNew()
    expect(field(/^name/i)).toHaveAttribute('placeholder', 'Enter user name')
    expect(field(/^email/i)).toHaveAttribute('placeholder', 'Enter email address')
    expect(passwordField()).toHaveAttribute('placeholder', 'Enter password')
    expect(passwordField()).toHaveAttribute('type', 'password')
    expect(passwordField()).toHaveAttribute('autocomplete', 'new-password')
    const active = within(dialog).getByRole('switch', { name: 'Active' })
    expect(active).toBeChecked()

    await fillNew(dialog)
    await userEvent.click(active)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(createMock).toHaveBeenCalledWith({
      name: 'Ada Lin',
      email: 'ada@example.test',
      password: SECRET,
      isActive: false,
    })
    expect(screen.getByRole('status')).toHaveTextContent('User created')
    const row = within(await table())
      .getByText('Ada Lin')
      .closest('tr') as HTMLElement
    expect(within(row).getByText('Inactive')).toBeInTheDocument()
    // The password went to the request and nowhere else on the page.
    expect(document.body).not.toHaveTextContent(SECRET)
  })

  it('shows and hides the password on request', async () => {
    renderAt()
    await openNew()
    await userEvent.type(passwordField(), SECRET)
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(passwordField()).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(passwordField()).toHaveAttribute('type', 'password')
  })

  it('asks for every field and a valid email before sending', async () => {
    renderAt()
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(await within(dialog).findByText('Enter the user’s name.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter an email address.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a password.')).toBeInTheDocument()

    await userEvent.type(field(/^email/i), 'not-an-email')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(await within(dialog).findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('shows it is working, cannot be sent twice, and never echoes the password in an error or log', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    )
    let fail: (reason: unknown) => void = () => undefined
    createMock.mockImplementation(() => new Promise((_, reject) => (fail = reject)))
    renderAt()
    const dialog = await fillNew(await openNew())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))
    const busy = within(dialog).getByRole('button', { name: 'Create user' })
    await waitFor(() => expect(busy).toBeDisabled())
    await userEvent.click(busy)
    expect(createMock).toHaveBeenCalledOnce()

    fail(new ApiError({ kind: 'server', message: `insert failed for password=${SECRET}`, status: 500 }))
    expect(await within(dialog).findByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(SECRET))).not.toBeInTheDocument()
    const logged = spies.flatMap((spy) => spy.mock.calls.flat().map((arg) => String(arg)))
    expect(logged.some((line) => line.includes(SECRET))).toBe(false)
  })

  it('puts a server field error on its field', async () => {
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'email', message: 'The email has already been taken.' }],
      }),
    )
    renderAt()
    const dialog = await fillNew(await openNew())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(await within(dialog).findByText('The email has already been taken.')).toBeInTheDocument()
    await waitFor(() => expect(field(/^email/i)).toHaveFocus())
  })

  it('edits a user with no password field at all, and maps Active to the switch', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Owen Park' }))
    const dialog = screen.getByRole('dialog')
    expect(field(/^name/i)).toHaveValue('Owen Park')
    expect(field(/^email/i)).toHaveValue('o.park@example.test')
    expect(within(dialog).queryByLabelText(/password/i)).not.toBeInTheDocument()
    const active = within(dialog).getByRole('switch', { name: 'Active' })
    expect(active).not.toBeChecked()

    await userEvent.click(active)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save user' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(3, {
      name: 'Owen Park',
      email: 'o.park@example.test',
      isActive: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent('User saved')
  })

  it('deactivates and reactivates from the row after a confirmation, changing only the status', async () => {
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Marcus Reyes' }))
    const confirm = screen.getByRole('alertdialog', { name: 'Deactivate Marcus Reyes?' })
    expect(confirm).toHaveTextContent('Their status becomes Inactive.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate user' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(1, {
      name: 'Marcus Reyes',
      email: 'm.reyes@example.test',
      isActive: false,
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Reactivate Owen Park' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Reactivate Owen Park?' })).getByRole('button', {
        name: 'Reactivate user',
      }),
    )
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2))
    expect(updateMock).toHaveBeenLastCalledWith(3, {
      name: 'Owen Park',
      email: 'o.park@example.test',
      isActive: true,
    })
  })
})
