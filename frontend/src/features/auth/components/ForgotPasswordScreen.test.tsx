import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { ApiError } from '@/lib/api/api-error'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { resetPassword, sendOtp, verifyOtp } from '../api/auth-api'

// Only the integration point is faked; the route, the steps and the forms run
// for real. Each test says what the server would have answered.
vi.mock('../api/auth-api', () => ({
  signIn: vi.fn(),
  changePassword: vi.fn(),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  resetPassword: vi.fn(),
}))
const sendMock = vi.mocked(sendOtp)
const verifyMock = vi.mocked(verifyOtp)
const resetMock = vi.mocked(resetPassword)

const EMAIL = 'user@example.test'

function renderFlow() {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/forgot-password'] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return { router }
}

const heading = (name: RegExp) => screen.findByRole('heading', { level: 1, name })

async function sendCode() {
  await userEvent.type(await screen.findByRole('textbox', { name: /^email/i }), EMAIL)
  await userEvent.click(screen.getByRole('button', { name: 'Send code' }))
  await heading(/check your email/i)
}

async function verifyCode(code = '123456') {
  await userEvent.type(screen.getByRole('textbox', { name: /^code/i }), code)
  await userEvent.click(screen.getByRole('button', { name: 'Verify code' }))
}

beforeEach(() => {
  sendMock.mockReset().mockResolvedValue(undefined)
  verifyMock.mockReset().mockResolvedValue(undefined)
  resetMock.mockReset().mockResolvedValue(undefined)
})

describe('forgot password', () => {
  it('runs the three steps with the exact values each request needs, then sends the user to sign in', async () => {
    const { router } = renderFlow()
    // The first test pays for loading the route's code-split chunk; under a
    // full, parallel run the default one second is not always enough.
    expect(
      await screen.findByRole('heading', { level: 1, name: /reset your password/i }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Reset password · EMR Billing')

    await sendCode()
    expect(sendMock).toHaveBeenCalledWith({ email: EMAIL })
    // Worded so it does not confirm that the account exists.
    expect(
      screen.getByText('If this email has an account, we sent it a code. Enter it below.'),
    ).toBeInTheDocument()
    // The email is shown once, beside the way to change it.
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())

    await verifyCode('123456')
    expect(await heading(/choose a new password/i)).toBeInTheDocument()
    expect(verifyMock).toHaveBeenCalledWith(EMAIL, '123456')

    await userEvent.type(screen.getByLabelText(/^new password/i), 'new-pw')
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'new-pw')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await heading(/password reset/i)).toBeInTheDocument()
    expect(resetMock).toHaveBeenCalledWith(EMAIL, '123456', { password: 'new-pw', confirmPassword: 'new-pw' })
    // Nothing of the flow is in the address.
    expect(router.state.location.href).toBe('/forgot-password')

    await userEvent.click(screen.getByRole('link', { name: /sign in/i }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })

  it('checks the email before asking for a code', async () => {
    renderFlow()
    await userEvent.click(await screen.findByRole('button', { name: 'Send code' }))
    expect(await screen.findByText('Enter your email.')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: /^email/i }), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('shows each step working, and does not send twice', async () => {
    let finish: () => void = () => undefined
    sendMock.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)))
    renderFlow()
    await userEvent.type(await screen.findByRole('textbox', { name: /^email/i }), EMAIL)
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }))
    const busy = await screen.findByRole('button', { name: 'Sending…' })
    expect(busy).toBeDisabled()
    await userEvent.click(busy)
    expect(sendMock).toHaveBeenCalledOnce()
    finish()
    await heading(/check your email/i)
  })

  it('puts a rejected code on the code field and stays on the step', async () => {
    verifyMock.mockRejectedValue(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'otp', message: 'This code is invalid or has expired.' }],
      }),
    )
    renderFlow()
    await sendCode()
    await verifyCode('000000')
    expect(await screen.findByText('This code is invalid or has expired.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^code/i })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/check your email/i)
  })

  it('asks for the code before checking it', async () => {
    renderFlow()
    await sendCode()
    await userEvent.click(screen.getByRole('button', { name: 'Verify code' }))
    expect(await screen.findByText('Enter the code from the email.')).toBeInTheDocument()
    expect(verifyMock).not.toHaveBeenCalled()
  })

  it('sends a new code to the same email, and can go back to change the email', async () => {
    renderFlow()
    await sendCode()
    await userEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(2))
    expect(sendMock).toHaveBeenLastCalledWith({ email: EMAIL })
    expect(await screen.findByRole('status')).toHaveTextContent('A new code is on its way')

    await userEvent.click(screen.getByRole('button', { name: 'Change email' }))
    expect(await heading(/reset your password/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^email/i })).toHaveValue(EMAIL)
  })

  it('requires both passwords and that they match', async () => {
    renderFlow()
    await sendCode()
    await verifyCode()
    await heading(/choose a new password/i)
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(await screen.findByText('Enter a new password.')).toBeInTheDocument()
    expect(screen.getByText('Confirm the new password.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/^new password/i), 'new-pw')
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'other-pw')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument()
    expect(resetMock).not.toHaveBeenCalled()
  })

  it('offers to start over when the reset is refused for a reason outside the form', async () => {
    resetMock.mockRejectedValue(
      new ApiError({
        kind: 'validation',
        message: 'Some fields need attention.',
        status: 422,
        fieldErrors: [{ path: 'otp', message: 'This code has expired.' }],
      }),
    )
    renderFlow()
    await sendCode()
    await verifyCode()
    await heading(/choose a new password/i)
    await userEvent.type(screen.getByLabelText(/^new password/i), 'new-pw')
    await userEvent.type(screen.getByLabelText(/^confirm new password/i), 'new-pw')
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    expect(await screen.findByText('This code has expired.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expect(await heading(/reset your password/i)).toBeInTheDocument()
  })

  it('explains a network failure in plain words', async () => {
    sendMock.mockRejectedValue(new ApiError({ kind: 'network', message: 'Failed to fetch' }))
    renderFlow()
    await userEvent.type(await screen.findByRole('textbox', { name: /^email/i }), EMAIL)
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
  })
})
