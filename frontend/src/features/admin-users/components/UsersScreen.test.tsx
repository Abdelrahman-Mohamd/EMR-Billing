import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { clearSession, hasSession, setSession } from '@/lib/auth/session'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { createUser, deleteUser, getUser, listUsers, setUserActive, updateUser } from '../api/users-api'
import type { User, UserPage } from '../schemas/user'

// Only the integration point is faked; route, queries, table, dialogs and
// forms run for real. `server` is what the fake backend holds, in its order,
// paged 15 at a time as the real one does.
vi.mock('../api/users-api', () => ({
  listUsers: vi.fn(),
  getUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserActive: vi.fn(),
  deleteUser: vi.fn(),
}))
// Who is signed in: another feature's integration point, faked by path.
const meMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/auth/api/auth-api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCurrentUser: meMock,
}))
const listMock = vi.mocked(listUsers)
const getMock = vi.mocked(getUser)
const createMock = vi.mocked(createUser)
const updateMock = vi.mocked(updateUser)
const setActiveMock = vi.mocked(setUserActive)
const deleteMock = vi.mocked(deleteUser)

const SECRET = 'Tr1cky-S3cret'
const PER_PAGE = 15

let server: User[]

/** As the server pages and searches (the name or email, in part). */
function page(number: number, search = ''): UserPage {
  const q = search.toLowerCase()
  const found = server.filter(
    (user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q),
  )
  const start = (number - 1) * PER_PAGE
  const slice = found.slice(start, start + PER_PAGE)
  return {
    users: slice.map((user) => ({ ...user })),
    page: number,
    pageCount: Math.max(1, Math.ceil(found.length / PER_PAGE)),
    total: found.length,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
  }
}

beforeEach(() => {
  server = [
    { id: 1, name: 'Marcus Reyes', email: 'm.reyes@example.test', isActive: true },
    { id: 2, name: 'Dana Whitfield', email: 'd.whitfield@example.test', isActive: true },
    { id: 3, name: 'Owen Park', email: 'o.park@example.test', isActive: false },
  ]
  listMock.mockReset().mockImplementation((number, search) => Promise.resolve(page(number, search)))
  getMock.mockReset().mockImplementation((id) => {
    const found = server.find((user) => user.id === id)
    return found
      ? Promise.resolve({ ...found })
      : Promise.reject(new ApiError({ kind: 'not_found', message: 'Not found', status: 404 }))
  })
  // As the backend answers: its own message, no record.
  createMock.mockReset().mockImplementation((values) => {
    server = [...server, { id: 9, name: values.name, email: values.email, isActive: values.isActive }]
    return Promise.resolve('User created successfully')
  })
  updateMock.mockReset().mockImplementation((id, values) => {
    server = server.map((user) =>
      user.id === id ? { id, name: values.name, email: values.email, isActive: values.isActive } : user,
    )
    return Promise.resolve('User updated successfully')
  })
  setActiveMock.mockReset().mockImplementation((user, isActive) => {
    server = server.map((item) => (item.id === user.id ? { ...item, isActive } : item))
    return Promise.resolve('User updated successfully')
  })
  deleteMock.mockReset().mockImplementation((id) => {
    server = server.filter((user) => user.id !== id)
    return Promise.resolve('User deleted successfully')
  })
  // Signed in as Dana (id 2).
  meMock.mockReset().mockResolvedValue({
    id: 2,
    name: 'Dana Whitfield',
    email: 'd.whitfield@example.test',
    isActive: true,
    createdAt: '2026-10-05T19:23:35.000000Z',
    updatedAt: '2026-10-05T19:23:35.000000Z',
  })
})
afterEach(() => {
  useToastStore.getState().clear()
  clearSession()
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

const table = () => screen.findByRole('table', { name: 'Users' }, { timeout: 5000 })
const field = (name: RegExp) => screen.getByRole('textbox', { name })
const passwordField = () => screen.getByLabelText(/^(new )?password/i)

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New user' }, { timeout: 5000 }))
  return screen.getByRole('dialog')
}

async function openEdit(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }, { timeout: 5000 }))
  const dialog = screen.getByRole('dialog')
  await within(dialog).findByRole('textbox', { name: /^name/i })
  return dialog
}

async function fillNew(dialog: HTMLElement) {
  await userEvent.type(field(/^name/i), 'Ada Lin')
  await userEvent.type(field(/^email/i), 'ada@example.test')
  await userEvent.type(passwordField(), SECRET)
  return dialog
}

describe('Admin → Users', () => {
  it('lists users in the server order with email and status, under Admin', async () => {
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
      expect.stringContaining('Marcus Reyes'),
      expect.stringContaining('Dana Whitfield'),
      expect.stringContaining('Owen Park'),
    ])
    expect(within(rows[1] as HTMLElement).getAllByText('d.whitfield@example.test').length).toBeGreaterThan(0)
    // The shared Active switch: on is Active, off is Inactive.
    expect(within(rows[0] as HTMLElement).getByRole('switch', { name: 'Marcus Reyes: active' })).toBeChecked()
    expect(
      within(rows[2] as HTMLElement).getByRole('switch', { name: 'Owen Park: active' }),
    ).not.toBeChecked()
    // No password column, and nothing password-like in the table.
    expect(within(await table()).queryByText(/password/i)).not.toBeInTheDocument()
    expect(screen.getByText('3 users')).toBeInTheDocument()
  })

  it('pages as the server does, 15 at a time', async () => {
    server = Array.from({ length: 20 }, (_, index) => ({
      id: index + 1,
      name: `User ${index + 1}`,
      email: `user${index + 1}@example.test`,
      isActive: true,
    }))
    renderAt()
    expect(await screen.findByText('Showing 1–15 of 20 users', {}, { timeout: 5000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText('Showing 16–20 of 20 users')).toBeInTheDocument()
    expect(listMock).toHaveBeenLastCalledWith(2, '', expect.anything())
  })

  it('searches on the server by name or email', async () => {
    renderAt()
    await screen.findByText('3 users', {}, { timeout: 5000 })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search users by name or email' }), 'o.park')
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(1, 'o.park', expect.anything()))
    expect(await screen.findByText('1 user')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search users by name or email' }), 'zz')
    expect(await screen.findByText('No users match')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(await screen.findByText('3 users')).toBeInTheDocument()
  })

  it('shows a loading state, a failed load with a retry, and an empty list', async () => {
    listMock.mockRejectedValueOnce(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderAt()
    expect(await screen.findByRole('status', {}, { timeout: 5000 })).toHaveTextContent('Loading')
    server = []
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }))
    expect(await screen.findByText('No users yet')).toBeInTheDocument()
  })

  it('creates a user with exactly the entered values, starting active, and says so in the server words', async () => {
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
    expect(screen.getByRole('status')).toHaveTextContent('User created successfully')
    const row = (await within(await table()).findByText('Ada Lin')).closest('tr') as HTMLElement
    expect(within(row).getByRole('switch', { name: 'Ada Lin: active' })).not.toBeChecked()
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

  it('puts the server field errors on their fields', async () => {
    createMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'validation',
        message: 'The email has already been taken. (and 1 more error)',
        serverMessage: 'The email has already been taken. (and 1 more error)',
        status: 422,
        fieldErrors: [
          { path: 'email', message: 'The email has already been taken.' },
          { path: 'password', message: 'The password field must be at least 8 characters.' },
        ],
      }),
    )
    renderAt()
    const dialog = await fillNew(await openNew())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create user' }))
    expect(await within(dialog).findByText('The email has already been taken.')).toBeInTheDocument()
    expect(within(dialog).getByText('The password field must be at least 8 characters.')).toBeInTheDocument()
    await waitFor(() => expect(field(/^email/i)).toHaveFocus())
  })

  it('edits a user as the server has them, keeping the password unless a new one is typed', async () => {
    renderAt()
    await table()
    // Renamed elsewhere since the list was loaded.
    server = server.map((user) => (user.id === 3 ? { ...user, name: 'Owen Park Jr' } : user))
    const dialog = await openEdit('Owen Park')
    expect(getMock).toHaveBeenCalledWith(3, expect.anything())
    expect(field(/^name/i)).toHaveValue('Owen Park Jr')
    expect(field(/^email/i)).toHaveValue('o.park@example.test')
    // An empty New password: a stored one is never shown or pre-filled.
    expect(passwordField()).toHaveValue('')
    expect(passwordField()).toHaveAttribute('placeholder', 'Enter a new password')
    expect(within(dialog).getByRole('button', { name: 'About New password' })).toHaveAccessibleDescription(
      'Leave it empty to keep the current password.',
    )
    const active = within(dialog).getByRole('switch', { name: 'Active' })
    expect(active).not.toBeChecked()

    await userEvent.click(active)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save user' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(updateMock).toHaveBeenCalledWith(3, {
      name: 'Owen Park Jr',
      email: 'o.park@example.test',
      password: '',
      isActive: true,
    })
    expect(screen.getByRole('status')).toHaveTextContent('User updated successfully')
  })

  it('sets a new password from the edit form', async () => {
    renderAt()
    const dialog = await openEdit('Marcus Reyes')
    await userEvent.type(passwordField(), SECRET)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save user' }))
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(1, expect.objectContaining({ password: SECRET })),
    )
    expect(document.body).not.toHaveTextContent(SECRET)
  })

  it('deactivates and reactivates with the Active switch after a confirmation, changing only the status', async () => {
    renderAt()
    const marcus = await screen.findByRole('switch', { name: 'Marcus Reyes: active' }, { timeout: 5000 })
    await userEvent.click(marcus)
    // Asked first, as in the prototype: the switch waits for the answer.
    expect(marcus).toBeChecked()
    const confirm = screen.getByRole('alertdialog', { name: 'Deactivate Marcus Reyes?' })
    expect(confirm).toHaveTextContent('Their status becomes Inactive.')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Deactivate user' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(setActiveMock).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), false)
    expect(marcus).not.toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('User updated successfully')

    await userEvent.click(await screen.findByRole('switch', { name: 'Owen Park: active' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Reactivate Owen Park?' })).getByRole('button', {
        name: 'Reactivate user',
      }),
    )
    await waitFor(() =>
      expect(setActiveMock).toHaveBeenLastCalledWith(expect.objectContaining({ id: 3 }), true),
    )
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('deletes a user after asking, but offers no Delete on the signed-in user', async () => {
    renderAt()
    await screen.findByRole('button', { name: 'Delete Marcus Reyes' }, { timeout: 5000 })
    // Signed in as Dana: her own row has Edit, not Delete.
    expect(screen.getByRole('button', { name: 'Edit Dana Whitfield' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Dana Whitfield' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Marcus Reyes' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Delete Marcus Reyes?' })
    expect(ask).toHaveTextContent('They can no longer sign in.')
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete user' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteMock).toHaveBeenCalledWith(1)
    expect(screen.getByRole('status')).toHaveTextContent('User deleted successfully')
    await waitFor(async () =>
      expect(within(await table()).queryByText('Marcus Reyes')).not.toBeInTheDocument(),
    )
  })

  it('says why when a delete is refused', async () => {
    deleteMock.mockRejectedValueOnce(
      new ApiError({
        kind: 'forbidden',
        message: 'You cannot delete this user.',
        serverMessage: 'You cannot delete this user.',
        status: 403,
      }),
    )
    renderAt()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Owen Park' }, { timeout: 5000 }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete user' }),
    )
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          tone: 'error',
          title: 'Owen Park was not deleted',
          description: 'You cannot delete this user.',
        }),
      ]),
    )
  })
})

describe('Admin → Users — one’s own account (user, 2026-10-19)', () => {
  it('cannot be deactivated: its switch is off in the list and in the form', async () => {
    renderAt()
    const rows = within(await table())
      .getAllByRole('row')
      .slice(1)
    await waitFor(() =>
      expect(
        within(rows[1] as HTMLElement).getByRole('switch', { name: 'Dana Whitfield: active' }),
      ).toBeDisabled(),
    )
    expect(within(rows[0] as HTMLElement).getByRole('switch', { name: 'Marcus Reyes: active' })).toBeEnabled()
    const dialog = await openEdit('Dana Whitfield')
    expect(within(dialog).getByRole('switch', { name: 'Active' })).toBeDisabled()
  })

  it('warns before saving a new password of one’s own, then goes to sign-in to use it', async () => {
    setSession({ accessToken: 'test-token', tokenType: 'Bearer' })
    const { router } = renderAt()
    const dialog = await openEdit('Dana Whitfield')
    const warning = 'Saving a new password for your own account signs you out everywhere'
    expect(within(dialog).queryByText(new RegExp(warning))).not.toBeInTheDocument()
    await userEvent.type(passwordField(), SECRET)
    expect(within(dialog).getByText(new RegExp(warning))).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save user' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 })
    expect(router.state.location.search).toEqual({ redirect: '/admin/users', ended: 'password-changed' })
    expect(
      await screen.findByText('Your password was changed. Sign in with your new password.'),
    ).toBeVisible()
    expect(hasSession()).toBe(false)
    // The server's words, as they are.
    expect(useToastStore.getState().toasts[0]).toEqual(
      expect.objectContaining({ title: 'User updated successfully' }),
    )
  })

  it('says nothing of the kind for someone else’s new password', async () => {
    setSession({ accessToken: 'test-token', tokenType: 'Bearer' })
    const { router } = renderAt()
    const dialog = await openEdit('Marcus Reyes')
    await userEvent.type(passwordField(), SECRET)
    expect(within(dialog).queryByText(/signs you out everywhere/)).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save user' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/admin/users')
    expect(hasSession()).toBe(true)
  })

  it('a new email of one’s own: the account menu reads it again, and says to sign in with it', async () => {
    renderAt()
    const dialog = await openEdit('Dana Whitfield')
    await waitFor(() => expect(meMock).toHaveBeenCalled())
    const before = meMock.mock.calls.length
    const email = field(/^email/i)
    await userEvent.clear(email)
    await userEvent.type(email, 'dana.w@example.test')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save user' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useToastStore.getState().toasts.at(-1)).toEqual(
      expect.objectContaining({
        title: 'User updated successfully',
        description: 'Sign in with your new email next time.',
      }),
    )
    await waitFor(() => expect(meMock.mock.calls.length).toBeGreaterThan(before))
  })
})
