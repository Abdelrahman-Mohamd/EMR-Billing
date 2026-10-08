import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { clearSession, hasSession, setSession } from '@/lib/auth/session'
import { createTestQueryClient, renderWithProviders } from '@/test/render'

// The whole flow with the app configured for the backend: guard → sign in →
// back to the page, signed in. Only the network is faked.
vi.mock('@/lib/config/env', () => ({
  env: {
    apiBaseUrl: 'https://api.example.test/api/v1',
    dataSource: 'live',
    environment: 'staging',
    isLive: true,
  },
}))

const fetchMock = vi.fn<typeof fetch>()
const LOGIN_OK = {
  success: true,
  message: 'Logged in successfully',
  data: {
    user: {
      id: 1,
      name: 'Super Admin',
      email: 'admin@billing.test',
      is_active: true,
      created_at: '2026-10-05T19:23:35.000000Z',
      updated_at: '2026-10-05T19:23:35.000000Z',
    },
    access_token: 'test-token-123',
    token_type: 'Bearer',
  },
}

beforeEach(() => {
  clearSession()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
})

function renderAt(path: string) {
  const queryClient = createTestQueryClient()
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  renderWithProviders(<RouterProvider router={router} />, { queryClient })
  return router
}

describe('signing in to the application', () => {
  it('sends a visitor without a session to sign in, then back to the page, signed in', async () => {
    const router = renderAt('/patients')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toEqual({ redirect: '/patients' })

    fetchMock.mockImplementation((url) =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            // The client always sends a string URL.
            (url as string).endsWith('/auth/me')
              ? { success: true, message: 'User retrieved successfully', data: LOGIN_OK.data.user }
              : LOGIN_OK,
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    await userEvent.type(
      await screen.findByRole('textbox', { name: /^email/i }, { timeout: 5000 }),
      'admin@billing.test',
    )
    await userEvent.type(screen.getByLabelText(/^password/i), 'the password')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/patients'), { timeout: 5000 })
    expect(hasSession()).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe('https://api.example.test/api/v1/auth/login')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'admin@billing.test',
      password: 'the password',
    })
    // Who signed in is who the account menu shows.
    expect(
      await screen.findByRole('button', { name: 'Account: Super Admin' }, { timeout: 5000 }),
    ).toBeInTheDocument()
  }, 15_000)

  it('keeps a session from before a reload, checking it once with GET /auth/me', async () => {
    setSession({ accessToken: 'kept-token', tokenType: 'Bearer' })
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, message: 'User retrieved successfully', data: LOGIN_OK.data.user }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const router = renderAt('/patients')
    expect(
      await screen.findByRole('button', { name: 'Account: Super Admin' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/patients')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe('https://api.example.test/api/v1/auth/me')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer kept-token')
    // Checked once; the page's own reads (its practices) are not this test's business.
    expect(fetchMock.mock.calls.filter(([called]) => (called as string).endsWith('/auth/me'))).toHaveLength(1)
  }, 15_000)

  it('sends a kept token the server no longer accepts to sign in, and forgets it', async () => {
    setSession({ accessToken: 'expired-token', tokenType: 'Bearer' })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthenticated.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const router = renderAt('/patients')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 })
    expect(router.state.location.search).toEqual({ redirect: '/patients' })
    expect(hasSession()).toBe(false)
  }, 15_000)

  it('keeps the user on sign in with the server message when the credentials are refused', async () => {
    renderAt('/login')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, message: 'Invalid credentials', errors: [] }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await userEvent.type(
      await screen.findByRole('textbox', { name: /^email/i }, { timeout: 5000 }),
      'admin@billing.test',
    )
    await userEvent.type(screen.getByLabelText(/^password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Invalid credentials')).toBeVisible()
    expect(hasSession()).toBe(false)
  }, 15_000)
})
