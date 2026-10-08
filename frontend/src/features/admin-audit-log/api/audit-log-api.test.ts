import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { getAuditEntry, listAuditEntries } from './audit-log-api'

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

/** Entries in the confirmed shape (2026-10-07). */
const LOGIN = {
  id: 33,
  log_name: 'auth',
  event: 'login',
  description: 'Logged in',
  subject_type: 'user',
  subject_id: 1,
  causer: { id: 1, name: 'Super Admin', email: 'admin@billing.test' },
  changes: { old: null, attributes: null },
  properties: { ip_address: '104.232.37.17' },
  batch_uuid: null,
  created_at: '2026-10-07T15:16:52.000000Z',
}
const LOGIN_FAILED = {
  id: 25,
  log_name: 'auth',
  event: 'login_failed',
  description: 'Failed login attempt',
  subject_type: null,
  subject_id: null,
  causer: null,
  changes: { old: null, attributes: null },
  properties: { email: 'someone@example.test', ip_address: '104.232.37.17' },
  batch_uuid: null,
  created_at: '2026-10-07T14:21:18.000000Z',
}

const page = (data: unknown[], meta: Record<string, unknown> = {}) => ({
  success: true,
  message: 'Activity logs retrieved successfully',
  data: {
    data,
    links: {
      first: `${BASE}/activity-logs?page=1`,
      last: `${BASE}/activity-logs?page=3`,
      prev: null,
      next: null,
    },
    meta: {
      current_page: 2,
      from: 16,
      last_page: 3,
      links: [],
      path: `${BASE}/activity-logs`,
      per_page: 15,
      to: 30,
      total: 35,
      ...meta,
    },
  },
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setSession({ accessToken: 'test-token-123', tokenType: 'Bearer' })
})
afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
})

describe('audit log against the backend', () => {
  it('asks GET /activity-logs for one page, with the session token and no other parameter', async () => {
    fetchMock.mockResolvedValueOnce(json(200, page([LOGIN])))
    await listAuditEntries({ page: 2 })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe(`${BASE}/activity-logs?page=2`)
    expect(init?.method).toBe('GET')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token-123')
  })

  it('reads the entries and the server paging', async () => {
    fetchMock.mockResolvedValueOnce(json(200, page([LOGIN, LOGIN_FAILED])))
    const result = await listAuditEntries({ page: 2 })
    expect(result).toMatchObject({ page: 2, pageCount: 3, total: 35, from: 16, to: 30 })
    expect(result.entries).toEqual([
      {
        id: '33',
        at: '2026-10-07T15:16:52.000000Z',
        userName: 'Super Admin',
        action: 'Logged in',
        event: 'login',
        detail: 'IP 104.232.37.17',
        module: 'auth',
      },
      {
        id: '25',
        at: '2026-10-07T14:21:18.000000Z',
        userName: '',
        action: 'Failed login attempt',
        event: 'login_failed',
        detail: 'someone@example.test · IP 104.232.37.17',
        module: 'auth',
      },
    ])
  })

  it('names changed fields but never their values, and takes an empty [] as empty', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        200,
        page([
          {
            ...LOGIN,
            event: 'updated',
            description: 'updated',
            changes: { old: { name: 'Old Name' }, attributes: { name: 'New Name', dob: '1970-01-01' } },
            properties: [],
          },
        ]),
      ),
    )
    const [entry] = (await listAuditEntries({ page: 1 })).entries
    expect(entry?.detail).toBe('Changed name, dob')
    expect(JSON.stringify(entry)).not.toMatch(/New Name|1970/)
  })

  it('reads an empty log', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, page([], { current_page: 1, last_page: 1, from: null, to: null, total: 0 })),
    )
    expect(await listAuditEntries({ page: 1 })).toMatchObject({ entries: [], total: 0, from: 0, to: 0 })
  })

  it('treats a body in another shape as a broken contract', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: [LOGIN] }))
    const error: unknown = await listAuditEntries({ page: 1 }).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('contract')
  })
})

describe('one audit entry against the backend', () => {
  it('asks GET /activity-logs/{id} with the session token and reads all of it', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, message: 'Activity log retrieved successfully', data: LOGIN }),
    )
    const entry = await getAuditEntry('33')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe(`${BASE}/activity-logs/33`)
    expect(init?.method).toBe('GET')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token-123')
    expect(entry).toMatchObject({
      id: '33',
      at: '2026-10-07T15:16:52.000000Z',
      action: 'Logged in',
      event: 'login',
      module: 'auth',
      user: { name: 'Super Admin', email: 'admin@billing.test' },
      properties: [{ key: 'ip_address', label: 'IP address', value: '104.232.37.17' }],
      record: 'User #1',
      batch: '',
      changes: [],
    })
  })

  it('reads a failed sign-in: no user, no record, the email tried', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: LOGIN_FAILED }))
    expect(await getAuditEntry('25')).toMatchObject({
      user: null,
      record: '',
      properties: [
        { key: 'email', label: 'Email', value: 'someone@example.test' },
        { key: 'ip_address', label: 'IP address', value: '104.232.37.17' },
      ],
    })
  })

  it('lists each changed field before and after, as text', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        data: {
          ...LOGIN,
          event: 'updated',
          changes: {
            old: { name: 'Old Name', is_active: true, removed_note: 'gone' },
            attributes: { name: 'New Name', is_active: false, tags: ['a', 'b'] },
          },
          properties: [],
          batch_uuid: '9f0c1a2b-0000-4000-8000-000000000000',
        },
      }),
    )
    const entry = await getAuditEntry('33')
    expect(entry.changes).toEqual([
      { field: 'name', label: 'Name', before: 'Old Name', after: 'New Name' },
      { field: 'is_active', label: 'Is active', before: 'true', after: 'false' },
      { field: 'tags', label: 'Tags', before: '', after: '["a","b"]' },
      { field: 'removed_note', label: 'Removed note', before: 'gone', after: '' },
    ])
    expect(entry.properties).toEqual([])
    expect(entry.batch).toBe('9f0c1a2b-0000-4000-8000-000000000000')
  })

  it('reports an unknown entry as not found', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { message: 'No query results for model [Activity] 999999' }))
    const error: unknown = await getAuditEntry('999999').catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('not_found')
  })
})
