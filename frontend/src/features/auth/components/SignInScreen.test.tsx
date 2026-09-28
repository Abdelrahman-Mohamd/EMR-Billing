import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { signIn } from '../api/auth-api'

// The integration point is the only thing faked: everything from the route to
// the form runs for real. There is no backend, so each test says what the
// server would have answered.
vi.mock('../api/auth-api', () => ({ signIn: vi.fn() }))
const signInMock = vi.mocked(signIn)

function renderSignIn(path = '/login') {
  const queryClient = createTestQueryClient()
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createRouter({ routeTree, history, context: { queryClient } })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router, queryClient }
}

const email = () => screen.getByRole('textbox', { name: /^email/i })
const password = () => screen.getByLabelText(/^password/i)
const submit = () => screen.getByRole('button', { name: /sign in/i })

async function fillAndSubmit(user = 'd.whitfield@example.test', pass = 'correct horse') {
  await userEvent.type(email(), user)
  await userEvent.type(password(), pass)
  await userEvent.click(submit())
}

beforeEach(() => {
  signInMock.mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('sign-in page', () => {
  it('is a page of its own, without the application rail', async () => {
    renderSignIn()
    // The first test pays for loading the route's code-split chunk; under a
    // full, parallel run the default one second is not always enough.
    expect(
      await screen.findByRole('heading', { level: 1, name: /sign in to billing/i }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(document.title).toBe('Sign in · EMR Billing')
  })

  it('labels both fields and tells the browser which credentials they are', async () => {
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    expect(email()).toHaveAttribute('autocomplete', 'username')
    expect(email()).toHaveAttribute('type', 'email')
    expect(password()).toHaveAttribute('autocomplete', 'current-password')
    // A placeholder guides; the label still names the field.
    expect(email()).toHaveAttribute('placeholder', 'Enter your email')
    expect(password()).toHaveAttribute('placeholder', 'Enter your password')
    expect(email()).toHaveAccessibleName(/^email/i)
    expect(password()).toHaveAttribute('type', 'password')
  })

  it('asks for both fields before sending anything, starting with the first', async () => {
    renderSignIn()
    await userEvent.click(await screen.findByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Enter your email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(email()).toHaveAttribute('aria-invalid', 'true')
    expect(email()).toHaveFocus()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('does not accept an email made only of spaces, or one that is not an email', async () => {
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit('   ', 'x')
    expect(await screen.findByText('Enter your email.')).toBeInTheDocument()

    await userEvent.clear(email())
    await userEvent.type(email(), 'dwhitfield')
    await userEvent.click(submit())
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('submits from the keyboard with Enter', async () => {
    signInMock.mockResolvedValue(undefined)
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await userEvent.type(email(), '  d.whitfield@example.test ')
    await userEvent.type(password(), 'correct horse{Enter}')
    // The email is trimmed; the password is sent exactly as typed.
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith({
        email: 'd.whitfield@example.test',
        password: 'correct horse',
      }),
    )
  })

  it('goes to the start page after signing in', async () => {
    signInMock.mockResolvedValue(undefined)
    const { router } = renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('returns to the page that sent the user here', async () => {
    signInMock.mockResolvedValue(undefined)
    const { router } = renderSignIn('/login?redirect=%2Fdev%2Fui')
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    await waitFor(() => expect(router.state.location.pathname).toBe('/dev/ui'))
  })

  it('ignores a redirect that would leave the application', async () => {
    signInMock.mockResolvedValue(undefined)
    const { router } = renderSignIn('/login?redirect=%2F%2Fevil.example')
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('drops whatever the previous session had cached', async () => {
    signInMock.mockResolvedValue(undefined)
    const { queryClient } = renderSignIn()
    queryClient.setQueryData(['claims', 'list'], [{ id: 'from-the-last-user' }])
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    await waitFor(() => expect(queryClient.getQueryData(['claims', 'list'])).toBeUndefined())
  })

  it('shows that it is working, and cannot be sent twice', async () => {
    let finish: () => void = () => undefined
    signInMock.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()

    const busy = await screen.findByRole('button', { name: /signing in/i })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(busy)
    expect(signInMock).toHaveBeenCalledOnce()

    finish()
  })

  it('says the credentials are wrong without saying which one, and clears only the password', async () => {
    signInMock.mockRejectedValue(
      new ApiError({ kind: 'unauthenticated', message: 'Unknown user rcastillo', status: 401 }),
    )
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit('d.whitfield@example.test', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('The email or password is incorrect.')
    // The server's own wording never reaches the page: it could confirm an account exists.
    expect(screen.queryByText(/unknown user/i)).not.toBeInTheDocument()
    expect(email()).toHaveValue('d.whitfield@example.test')
    expect(password()).toHaveValue('')
    await waitFor(() => expect(password()).toHaveFocus())
  })

  it('explains a network failure in words a user can act on', async () => {
    signInMock.mockRejectedValue(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
  })

  it('never shows the text of an unexpected server failure', async () => {
    signInMock.mockRejectedValue(
      new ApiError({ kind: 'server', message: 'psycopg2.OperationalError at auth.py:88', status: 500 }),
    )
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    expect(screen.queryByText(/psycopg2/)).not.toBeInTheDocument()
  })

  it('says plainly when no sign-in server is available', async () => {
    signInMock.mockRejectedValue(
      new ApiError({ kind: 'unavailable', message: 'Sign-in is not available right now.' }),
    )
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('This service is not available right now.')
  })

  it('never writes the password to the console, even when sign-in fails', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    )
    signInMock.mockRejectedValue(new ApiError({ kind: 'unauthenticated', message: 'x', status: 401 }))
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit('d.whitfield@example.test', 'S3cret-pa55')
    await screen.findByRole('alert')

    const logged = spies.flatMap((spy) => spy.mock.calls.flat().map((arg) => String(arg)))
    expect(logged.some((line) => line.includes('S3cret-pa55'))).toBe(false)
  })

  it('shows and hides the password on request, and says which state it is in', async () => {
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    const toggle = screen.getByRole('button', { name: 'Show password' })

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(password()).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(toggle)
    expect(password()).toHaveAttribute('type', 'password')
  })

  it('moves through the page in reading order: email, password, forgot password, then sign in', async () => {
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await userEvent.tab()
    expect(email()).toHaveFocus()
    await userEvent.tab()
    expect(password()).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveFocus()
    await userEvent.tab()
    expect(submit()).toHaveFocus()
  })

  it('puts the server’s field messages on the fields they name', async () => {
    signInMock.mockRejectedValue(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'email', message: 'The email must be a valid email address.' }],
      }),
    )
    renderSignIn()
    await screen.findByRole('heading', { level: 1 })
    await fillAndSubmit()
    expect(await screen.findByText('The email must be a valid email address.')).toBeInTheDocument()
    expect(email()).toHaveAttribute('aria-invalid', 'true')
  })

  it('links to the forgot-password flow', async () => {
    const { router } = renderSignIn()
    await userEvent.click(await screen.findByRole('link', { name: 'Forgot your password?' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/forgot-password'))
    expect(await screen.findByRole('heading', { level: 1, name: /reset your password/i })).toBeInTheDocument()
  })
})
