import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  listAllOrganizations,
  listOrganizations,
  updateOrganization,
} from './organizations-api'

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

/** An item in the confirmed list shape (2026-10-07). */
const item = (id: number, name = `Group ${id}`) => ({
  id,
  name,
  is_active: true,
  practices_count: 0,
  created_at: '2026-10-07T16:06:23.000000Z',
})

const page = (data: unknown[], currentPage: number, lastPage: number, total: number) => ({
  success: true,
  message: 'Organizations retrieved successfully',
  data: {
    data,
    links: {
      first: `${BASE}/organizations?page=1`,
      last: `${BASE}/organizations?page=${lastPage}`,
      prev: null,
      next: null,
    },
    meta: {
      current_page: currentPage,
      from: data.length === 0 ? null : (currentPage - 1) * 15 + 1,
      last_page: lastPage,
      links: [],
      path: `${BASE}/organizations`,
      per_page: 15,
      to: data.length === 0 ? null : (currentPage - 1) * 15 + data.length,
      total,
    },
  },
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

describe('organizations against the backend', () => {
  it('asks the server to search, by name', async () => {
    fetchMock.mockResolvedValueOnce(json(200, page([item(1, 'PTc Health Group')], 1, 1, 1)))
    await listOrganizations(1, 'ptc')
    expect(call(0).url).toBe(`${BASE}/organizations?page=1&search=ptc`)
  })

  it('lists one page with GET /organizations?page=N and the session token', async () => {
    fetchMock.mockResolvedValueOnce(json(200, page([item(1, 'PTc Health Group')], 1, 1, 1)))
    const result = await listOrganizations(1)
    expect(call(0).url).toBe(`${BASE}/organizations?page=1`)
    expect(call(0).init.method).toBe('GET')
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(result).toEqual({
      organizations: [
        {
          id: 1,
          name: 'PTc Health Group',
          isActive: true,
          practicesCount: 0,
          createdAt: '2026-10-07T16:06:23.000000Z',
        },
      ],
      page: 1,
      pageCount: 1,
      total: 1,
      from: 1,
      to: 1,
    })
  })

  it('reads every page for a picker', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, page([item(1), item(2)], 1, 3, 32)))
      .mockResolvedValueOnce(json(200, page([item(16)], 2, 3, 32)))
      .mockResolvedValueOnce(json(200, page([item(31)], 3, 3, 32)))
    const all = await listAllOrganizations()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/organizations?page=1&per_page=100`,
      `${BASE}/organizations?page=2&per_page=100`,
      `${BASE}/organizations?page=3&per_page=100`,
    ])
    expect(all.map((organization) => organization.id)).toEqual([1, 2, 16, 31])
  })

  it('reads one organization with GET /organizations/{id}', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        message: 'Organization retrieved successfully',
        data: {
          id: 1,
          name: 'PTc Health Group',
          is_active: true,
          practices: [],
          created_at: '2026-10-07T16:06:23.000000Z',
        },
      }),
    )
    expect(await getOrganization(1)).toEqual({ id: 1, name: 'PTc Health Group', isActive: true })
    expect(call(0).url).toBe(`${BASE}/organizations/1`)
  })

  it('reports an unknown organization as not found', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { message: 'No query results for model [Organization] 99999' }))
    const error: unknown = await getOrganization(99999).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('not_found')
  })

  it('creates with POST, saves with PUT and deletes with DELETE, sending exactly the payload', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Organization created successfully'))
      .mockResolvedValueOnce(done('Organization updated successfully'))
      .mockResolvedValueOnce(done('Organization deleted successfully'))
    await expect(createOrganization({ name: 'PTc Health Group', isActive: true })).resolves.toBe(
      'Organization created successfully',
    )
    await expect(updateOrganization(1, { name: 'PTc Health Group II', isActive: false })).resolves.toBe(
      'Organization updated successfully',
    )
    await expect(deleteOrganization(2)).resolves.toBe('Organization deleted successfully')

    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/organizations`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({ name: 'PTc Health Group', is_active: true })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/organizations/1`])
    expect(JSON.parse(call(1).init.body as string)).toEqual({ name: 'PTc Health Group II', is_active: false })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/organizations/2`])
    expect(call(2).init.body).toBeUndefined()
    for (const index of [0, 1, 2])
      expect(call(index).headers.get('Authorization')).toBe('Bearer test-token-123')
  })

  it('puts a duplicate name (422) on the name field', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The name has already been taken.',
        errors: { name: ['The name has already been taken.'] },
      }),
    )
    const error: unknown = await createOrganization({ name: 'PTc Health Group', isActive: true }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors).toEqual([
      { path: 'name', message: 'The name has already been taken.' },
    ])
  })
})
