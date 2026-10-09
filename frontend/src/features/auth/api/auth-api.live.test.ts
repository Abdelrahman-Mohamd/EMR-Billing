import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { request } from '@/lib/api/http-client'
import { clearSession, hasSession } from '@/lib/auth/session'
import {
  changePassword,
  getCurrentUser,
  resetPassword,
  sendOtp,
  signIn,
  signOut,
  verifyOtp,
} from './auth-api'

// The app configured for the staging backend; only the network is faked.
const BASE = 'https://api.example.test/api/v1'
vi.mock('@/lib/config/env', () => ({
  env: {
    apiBaseUrl: 'https://api.example.test/api/v1',
    dataSource: 'live',
    environment: 'staging',
    isLive: true,
  },
}))

/** The confirmed success body, with a token invented for the test. */
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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()
const call = (index: number) => {
  const [url, init] = fetchMock.mock.calls[index] ?? []
  // The client always sends a string URL and a JSON string body.
  return { url: url as string, init: init ?? {}, headers: new Headers(init?.headers) }
}
const credentials = { email: 'admin@billing.test', password: 'the password' }

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  clearSession()
})
afterEach(async () => {
  // Leave no signed-in user behind for the next test (the server's answer here is irrelevant).
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  await signOut()
  vi.unstubAllGlobals()
})

describe('sign in against the backend', () => {
  it('posts exactly { email, password } to /auth/login, without cookies or a token', async () => {
    fetchMock.mockResolvedValueOnce(json(200, LOGIN_OK))
    await signIn(credentials)
    const { url, init, headers } = call(0)
    expect(url).toBe(`${BASE}/auth/login`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'admin@billing.test', password: 'the password' })
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.has('Authorization')).toBe(false)
    expect(init.credentials).toBe('omit')
  })

  it('resolves with the user — never the token — and establishes the session', async () => {
    fetchMock.mockResolvedValueOnce(json(200, LOGIN_OK))
    const user = await signIn(credentials)
    expect(user).toEqual({
      id: 1,
      name: 'Super Admin',
      email: 'admin@billing.test',
      isActive: true,
      createdAt: '2026-10-05T19:23:35.000000Z',
      updatedAt: '2026-10-05T19:23:35.000000Z',
    })
    expect(JSON.stringify(user)).not.toContain('test-token-123')
    expect(hasSession()).toBe(true)
  })

  it('sends the token as "Authorization: Bearer …" on every request after it', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await signIn(credentials)
    await request({ path: '/patients' })
    const { url, headers, init } = call(1)
    expect(url).toBe(`${BASE}/patients`)
    expect(headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(init.credentials).toBe('omit')
    // The token is never in the address.
    expect(url).not.toContain('test-token-123')
  })

  it('refuses wrong credentials as unauthenticated, with no session', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { success: false, message: 'Invalid credentials', errors: [] }))
    const error: unknown = await signIn(credentials).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('unauthenticated')
    expect(hasSession()).toBe(false)
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'unauthenticated' })
  })

  it('reads the server’s field errors (422) onto the fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The email field is required. (and 1 more error)',
        errors: { email: ['The email field is required.'], password: ['The password field is required.'] },
      }),
    )
    const error: unknown = await signIn(credentials).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('validation')
    expect(isApiError(error) && error.fieldErrors).toEqual([
      { path: 'email', message: 'The email field is required.' },
      { path: 'password', message: 'The password field is required.' },
    ])
  })

  it('reports a network failure, and an answer that breaks the contract, without a session', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const offline: unknown = await signIn(credentials).catch((caught: unknown) => caught)
    expect(isApiError(offline) && offline.kind).toBe('network')

    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: { user: LOGIN_OK.data.user } }))
    const broken: unknown = await signIn(credentials).catch((caught: unknown) => caught)
    expect(isApiError(broken) && broken.kind).toBe('contract')
    // A contract error names paths only, never the values it received.
    expect(isApiError(broken) && broken.detail).not.toContain('Super Admin')
    expect(hasSession()).toBe(false)
  })
})

describe('who is signed in', () => {
  it('asks GET /auth/me with the session token and reads the user', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(
        json(200, { success: true, message: 'User retrieved successfully', data: LOGIN_OK.data.user }),
      )
    const signedIn = await signIn(credentials)
    await expect(getCurrentUser()).resolves.toEqual(signedIn)
    const { url, init, headers } = call(1)
    expect(url).toBe(`${BASE}/auth/me`)
    expect(init.method).toBe('GET')
    expect(headers.get('Authorization')).toBe('Bearer test-token-123')
  })

  it('sends nothing without a session', async () => {
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'unauthenticated' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ends the session when the server no longer accepts the token (401)', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(json(401, { message: 'Unauthenticated.' }))
    await signIn(credentials)
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'unauthenticated' })
    expect(hasSession()).toBe(false)
  })
})

describe('after signing in', () => {
  it('a 401 on a request that carried the token ends the session', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(json(401, { message: 'Unauthenticated.' }))
    await signIn(credentials)
    const error: unknown = await request({ path: '/patients' }).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('unauthenticated')
    expect(hasSession()).toBe(false)
  })

  it('signs out with POST /auth/logout, carrying the token, then forgets the token and the user', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(json(200, { success: true, message: 'Successfully logged out.', data: null }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await signIn(credentials)
    await expect(signOut()).resolves.toBe('Successfully logged out.')
    const { url, init, headers } = call(1)
    expect(url).toBe(`${BASE}/auth/logout`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(hasSession()).toBe(false)
    await expect(getCurrentUser()).rejects.toMatchObject({ kind: 'unauthenticated' })
    // Nothing after it carries the old token.
    await request({ path: '/patients' })
    expect(call(2).headers.has('Authorization')).toBe(false)
  })

  it('counts a token the server no longer accepts (401) as signed out', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(json(401, { message: 'Unauthenticated.' }))
    await signIn(credentials)
    await expect(signOut()).resolves.toBeNull()
    expect(hasSession()).toBe(false)
  })

  it('still forgets the session when the server cannot be reached — and says it could not confirm', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await signIn(credentials)
    const error: unknown = await signOut().catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('network')
    expect(hasSession()).toBe(false)
  })
})

describe('forgot password against the backend', () => {
  it('sends each step’s exact payload to its endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          success: true,
          message: 'If this email is registered, a reset code has been sent to it.',
          data: null,
        }),
      )
      .mockResolvedValueOnce(json(200, { success: true, data: null }))
      .mockResolvedValueOnce(json(200, { success: true, data: null }))
    await sendOtp({ email: 'admin@billing.test' })
    await verifyOtp('admin@billing.test', '225491')
    await resetPassword('admin@billing.test', '225491', {
      password: '123456789',
      confirmPassword: '123456789',
    })

    const sent = [0, 1, 2].map((index) => {
      const { url, init } = call(index)
      return { url, method: init.method, body: JSON.parse(init.body as string) as unknown }
    })
    expect(sent).toEqual([
      { url: `${BASE}/auth/forgot-password/send-otp`, method: 'POST', body: { email: 'admin@billing.test' } },
      {
        url: `${BASE}/auth/forgot-password/verify-otp`,
        method: 'POST',
        body: { email: 'admin@billing.test', otp: '225491' },
      },
      {
        url: `${BASE}/auth/forgot-password/reset`,
        method: 'POST',
        body: {
          email: 'admin@billing.test',
          otp: '225491',
          password: '123456789',
          password_confirmation: '123456789',
        },
      },
    ])
  })

  it('reads a refused code (400, no field) as a validation error without fields', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { success: false, message: 'Invalid OTP.', errors: [] }))
    const error: unknown = await verifyOtp('admin@billing.test', '000000').catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('validation')
    expect(isApiError(error) && error.fieldErrors).toEqual([])
  })

  it('puts the server’s field errors on the form’s fields (password_confirmation → confirmPassword)', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The password field confirmation does not match.',
        errors: {
          password: ['The password field must be at least 8 characters.'],
          password_confirmation: ['The password field confirmation does not match.'],
        },
      }),
    )
    const error: unknown = await resetPassword('admin@billing.test', '225491', {
      password: 'a',
      confirmPassword: 'b',
    }).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'password',
      'confirmPassword',
    ])
  })
})

describe('change password against the backend', () => {
  const values = {
    currentPassword: 'password',
    newPassword: 'Example-pass-24',
    confirmPassword: 'Example-pass-24',
  }

  it('posts the exact payload to /auth/change-password with the session’s token', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(json(200, { success: true, data: null }))
    await signIn(credentials)
    await changePassword(values)
    const { url, init, headers } = call(1)
    expect(url).toBe(`${BASE}/auth/change-password`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      current_password: 'password',
      new_password: 'Example-pass-24',
      new_password_confirmation: 'Example-pass-24',
    })
    expect(headers.get('Authorization')).toBe('Bearer test-token-123')
  })

  it('reads a refused current password (400, no field), and new-password errors onto the form’s fields', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, LOGIN_OK))
      .mockResolvedValueOnce(
        json(400, { success: false, message: 'Current password is incorrect', errors: [] }),
      )
      .mockResolvedValueOnce(
        json(422, {
          message: 'The new password field confirmation does not match. (and 1 more error)',
          errors: {
            new_password: [
              'The new password field confirmation does not match.',
              'The new password field must be at least 8 characters.',
            ],
          },
        }),
      )
    await signIn(credentials)
    const refused: unknown = await changePassword(values).catch((caught: unknown) => caught)
    expect(isApiError(refused) && refused.kind).toBe('validation')
    expect(isApiError(refused) && refused.fieldErrors).toEqual([])

    const invalid: unknown = await changePassword(values).catch((caught: unknown) => caught)
    expect(isApiError(invalid) && invalid.fieldErrors).toEqual([
      { path: 'newPassword', message: 'The new password field confirmation does not match.' },
    ])
  })
})
