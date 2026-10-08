import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { createUser, deleteUser, getUser, listUsers, setUserActive, updateUser } from './users-api'

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

/** A user in the confirmed shape (2026-10-07). */
const wire = (id: number, name: string) => ({
  id,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
  is_active: true,
  created_at: '2026-10-07T19:24:46.000000Z',
  updated_at: '2026-10-07T19:24:46.000000Z',
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const done = (message: string) => json(200, { success: true, message, data: null })

const fetchMock = vi.fn<typeof fetch>()
const call = (index: number) => {
  const [url, init] = fetchMock.mock.calls[index] ?? []
  // The client always sends a string URL and a JSON string body.
  return { url: url as string, init: init ?? {}, headers: new Headers(init?.headers) }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setSession({ accessToken: 'test-token-123', tokenType: 'Bearer' })
})
afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
})

describe('users against the backend', () => {
  it('lists one page with GET /users?page=N', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        message: 'Users retrieved successfully',
        data: {
          data: [wire(1, 'Super Admin'), wire(2, 'Ahmed')],
          links: {},
          meta: { current_page: 1, from: 1, last_page: 1, links: [], per_page: 15, to: 2, total: 2 },
        },
      }),
    )
    const result = await listUsers(1)
    expect(call(0).url).toBe(`${BASE}/users?page=1`)
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(result).toEqual({
      users: [
        { id: 1, name: 'Super Admin', email: 'super.admin@example.test', isActive: true },
        { id: 2, name: 'Ahmed', email: 'ahmed@example.test', isActive: true },
      ],
      page: 1,
      pageCount: 1,
      total: 2,
      from: 1,
      to: 2,
    })
  })

  it('reads one user with GET /users/{id}', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: wire(2, 'Ahmed') }))
    expect(await getUser(2)).toEqual({ id: 2, name: 'Ahmed', email: 'ahmed@example.test', isActive: true })
    expect(call(0).url).toBe(`${BASE}/users/2`)
  })

  it('creates with POST /users, sending exactly the payload, and resolves with the server message', async () => {
    fetchMock.mockResolvedValueOnce(done('User created successfully'))
    await expect(
      createUser({ name: 'ahmed', email: 'nadia@example.com', password: 'Example-pass-24', isActive: true }),
    ).resolves.toBe('User created successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/users`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      name: 'ahmed',
      email: 'nadia@example.com',
      password: 'Example-pass-24',
      is_active: true,
    })
  })

  it('saves with PUT /users/{id}: a new password when one was typed, none to keep the current one', async () => {
    fetchMock
      .mockResolvedValueOnce(done('User updated successfully'))
      .mockResolvedValueOnce(done('User updated successfully'))
    await updateUser(1, {
      name: 'ahmed essam',
      email: 'ahmed@example.com',
      password: 'Example-pass-24',
      isActive: true,
    })
    await updateUser(1, { name: 'ahmed essam', email: 'ahmed@example.com', password: '', isActive: true })
    expect([call(0).init.method, call(0).url]).toEqual(['PUT', `${BASE}/users/1`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      name: 'ahmed essam',
      email: 'ahmed@example.com',
      password: 'Example-pass-24',
      is_active: true,
    })
    // An empty password is refused by the server ("required"); left out, the current one stays.
    expect(JSON.parse(call(1).init.body as string)).toEqual({
      name: 'ahmed essam',
      email: 'ahmed@example.com',
      is_active: true,
    })
  })

  it('changes status with the user name and email as they are, and no password', async () => {
    fetchMock.mockResolvedValueOnce(done('User updated successfully'))
    await setUserActive({ id: 2, name: 'Ahmed', email: 'ahmed@example.test', isActive: true }, false)
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      name: 'Ahmed',
      email: 'ahmed@example.test',
      is_active: false,
    })
  })

  it('deletes with DELETE /users/{id}', async () => {
    fetchMock.mockResolvedValueOnce(done('User deleted successfully'))
    await expect(deleteUser(3)).resolves.toBe('User deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['DELETE', `${BASE}/users/3`])
    expect(call(0).init.body).toBeUndefined()
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The email has already been taken.',
        errors: {
          email: ['The email has already been taken.'],
          is_active: ['The is active field must be true or false.'],
        },
      }),
    )
    const error: unknown = await createUser({
      name: 'ahmed',
      email: 'nadia@example.com',
      password: 'Example-pass-24',
      isActive: true,
    }).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'email',
      'isActive',
    ])
  })
})
