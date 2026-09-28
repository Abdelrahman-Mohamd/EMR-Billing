import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { useToastStore } from '@/stores/toast-store'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { changePassword, getCurrentUser, signOut } from '../api/auth-api'

// Only the integration point is faked; the shell, the menu, the dialogs and
// the forms run for real.
vi.mock('../api/auth-api', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  changePassword: vi.fn(),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  resetPassword: vi.fn(),
}))
const userMock = vi.mocked(getCurrentUser)
const changeMock = vi.mocked(changePassword)
const signOutMock = vi.mocked(signOut)

beforeEach(() => {
  userMock.mockReset().mockResolvedValue({ name: 'Dana Whitfield', email: 'd.whitfield@example.test' })
  changeMock.mockReset().mockResolvedValue(undefined)
  signOutMock.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  useToastStore.getState().clear()
})

function renderApp(path = '/') {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router, queryClient }
}

const accountButton = () =>
  screen.findByRole('button', { name: 'Account: Dana Whitfield' }, { timeout: 5000 })

async function openMenu() {
  await userEvent.click(await accountButton())
  return screen.findByRole('menu')
}

async function openChangePassword() {
  await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Change password' }))
  return screen.findByRole('dialog', { name: 'Change password' })
}

const current = () => screen.getByLabelText(/^current password/i)
const next = () => screen.getByLabelText(/^new password/i)
const confirm = () => screen.getByLabelText(/^confirm new password/i)

async function fill(currentValue = 'old-pw', newValue = 'new-pw', confirmValue = 'new-pw') {
  await userEvent.type(current(), currentValue)
  await userEvent.type(next(), newValue)
  await userEvent.type(confirm(), confirmValue)
}

describe('account menu', () => {
  it('shows the signed-in user’s initials in the rail, on every screen', async () => {
    renderApp('/admin/organizations')
    const button = await accountButton()
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: /^account/i }),
    ).toBe(button)
    expect(button).toHaveTextContent('DW')
  })

  it('opens a menu with who is signed in, Change password and Sign out', async () => {
    renderApp()
    const menu = await openMenu()
    expect(menu).toHaveTextContent('Dana Whitfield')
    expect(menu).toHaveTextContent('d.whitfield@example.test')
    expect(within(menu).getByRole('menuitem', { name: 'Change password' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('works from the keyboard and closes on Escape', async () => {
    renderApp()
    const button = await accountButton()
    button.focus()
    await userEvent.keyboard('{Enter}')
    const menu = await screen.findByRole('menu')
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: 'Change password' })).toHaveFocus())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(button).toHaveFocus()
  })

  it('still offers both actions when who is signed in is not known', async () => {
    userMock.mockRejectedValue(new ApiError({ kind: 'unavailable', message: 'Down.' }))
    renderApp()
    const button = await screen.findByRole('button', { name: 'Account' }, { timeout: 5000 })
    await userEvent.click(button)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Change password' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('has no separate change-password page any more', async () => {
    renderApp('/account/password')
    expect(
      await screen.findByRole('heading', { name: /page not found/i }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })
})

describe('change password dialog', () => {
  it('sends the three passwords, closes, confirms, and keeps the user signed in', async () => {
    const { router } = renderApp('/admin/users')
    const dialog = await openChangePassword()
    expect(current()).toHaveAttribute('placeholder', 'Enter current password')
    expect(next()).toHaveAttribute('placeholder', 'Enter new password')
    expect(confirm()).toHaveAttribute('placeholder', 'Confirm new password')
    for (const input of [current(), next(), confirm()]) expect(input).toHaveAttribute('type', 'password')

    await fill()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(changeMock).toHaveBeenCalledWith({
      currentPassword: 'old-pw',
      newPassword: 'new-pw',
      confirmPassword: 'new-pw',
    })
    expect(screen.getByRole('status')).toHaveTextContent('Password changed')
    expect(router.state.location.pathname).toBe('/admin/users')
    expect(signOutMock).not.toHaveBeenCalled()
    // Focus goes back to where the user started.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Account: Dana Whitfield' })).toHaveFocus())
  })

  it('starts empty every time it opens', async () => {
    renderApp()
    await openChangePassword()
    await userEvent.type(current(), 'typed-then-cancelled')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await openChangePassword()
    expect(current()).toHaveValue('')
  })

  it('asks for every field and for matching new passwords', async () => {
    renderApp()
    const dialog = await openChangePassword()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }))
    expect(await within(dialog).findByText('Enter your current password.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a new password.')).toBeInTheDocument()
    expect(within(dialog).getByText('Confirm the new password.')).toBeInTheDocument()
    await fill('old-pw', 'new-pw', 'other-pw')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }))
    expect(await within(dialog).findByText('The passwords do not match.')).toBeInTheDocument()
    expect(changeMock).not.toHaveBeenCalled()
  })

  it('shows it is working, stays open on failure, and puts a wrong current password on its field', async () => {
    let fail: (reason: unknown) => void = () => undefined
    changeMock.mockImplementation(() => new Promise((_, reject) => (fail = reject)))
    renderApp()
    const dialog = await openChangePassword()
    await fill('wrong-pw')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }))
    const busy = await within(dialog).findByRole('button', { name: 'Changing password…' })
    expect(busy).toBeDisabled()
    await userEvent.click(busy)
    expect(changeMock).toHaveBeenCalledOnce()

    fail(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'currentPassword', message: 'The current password is incorrect.' }],
      }),
    )
    expect(await within(dialog).findByText('The current password is incorrect.')).toBeInTheDocument()
    expect(current()).toHaveAttribute('aria-invalid', 'true')
    expect(next()).toHaveValue('new-pw')
  })

  it('explains a failure in plain words without echoing anything typed', async () => {
    changeMock.mockRejectedValue(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    renderApp()
    const dialog = await openChangePassword()
    await fill('S3cret-old', 'S3cret-new', 'S3cret-new')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }))
    expect(await within(dialog).findByText(/could not reach the server/i)).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('S3cret')
  })
})

describe('sign out', () => {
  it('asks first, then ends the session, clears what was cached and goes to sign in', async () => {
    const { router, queryClient } = renderApp('/admin/users')
    await accountButton()
    queryClient.setQueryData(['claims', 'list'], [{ id: 'from-this-session' }])
    await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Sign out' }))

    const ask = await screen.findByRole('alertdialog', { name: 'Sign out?' })
    expect(ask).toHaveTextContent('You will return to the sign-in screen.')
    await userEvent.click(within(ask).getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData(['claims', 'list'])).toBeUndefined()
    expect(await screen.findByRole('status')).toHaveTextContent('Signed out')
  })

  it('does nothing when the user changes their mind', async () => {
    const { router } = renderApp('/admin/users')
    await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Sign out' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Sign out?' })).getByRole('button', {
        name: 'Cancel',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(signOutMock).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/admin/users')
  })

  it('still signs this browser out when the server cannot be reached, and says so', async () => {
    signOutMock.mockRejectedValue(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    const { router } = renderApp()
    await userEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Sign out' }))
    await userEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Sign out?' })).getByRole('button', {
        name: 'Sign out',
      }),
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await screen.findByText('Signed out of this browser')).toBeInTheDocument()
  })
})
