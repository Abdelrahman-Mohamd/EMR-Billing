import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import {
  createReleaseBucket,
  deleteReleaseBucket,
  getReleaseBucket,
  listReleaseBuckets,
  setReleaseBucketActive,
  updateReleaseBucket,
} from './release-buckets-api'

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

/** A bucket in the confirmed shape (2026-10-07). */
const wire = (id: number) => ({
  id,
  practice_id: 1,
  name: 'Manual Release – WC Payers',
  description: "Workers' comp payers reviewed before sending",
  is_active: true,
  insurances_count: 2,
  created_at: '2026-10-07T20:12:12.000000Z',
})

const values = {
  practiceId: '3',
  name: 'Manual Release – WC Payers',
  description: "Workers' comp payers reviewed before sending",
  isActive: true,
}

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

describe('release buckets against the backend', () => {
  it('reads every page of GET /release-buckets', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16)], 2, 2)))
    const all = await listReleaseBuckets()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/release-buckets?page=1&per_page=100`,
      `${BASE}/release-buckets?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all[0]).toEqual({
      id: 1,
      practiceId: 1,
      name: 'Manual Release – WC Payers',
      description: "Workers' comp payers reviewed before sending",
      isActive: true,
      insurancesCount: 2,
    })
  })

  it('reads one bucket with GET /release-buckets/{id}, its insurances and practice left aside', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, data: { ...wire(1), insurances: [], practice: { id: 1, name: 'X' } } }),
    )
    expect(await getReleaseBucket(1)).toMatchObject({ id: 1, insurancesCount: 2 })
    expect(call(0).url).toBe(`${BASE}/release-buckets/1`)
  })

  it('creates with POST, with its practice; saves with PUT, without it', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Release bucket created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Release bucket updated successfully'))
    await expect(createReleaseBucket(values)).resolves.toBe('Release bucket created successfully')
    await expect(updateReleaseBucket(1, { ...values, description: '' })).resolves.toBe(
      'Release bucket updated successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/release-buckets`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      practice_id: 3,
      name: 'Manual Release – WC Payers',
      description: "Workers' comp payers reviewed before sending",
      is_active: true,
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/release-buckets/1`])
    // No practice_id on a save (refused: a bucket never moves); "" clears the description.
    expect(JSON.parse(call(1).init.body as string)).toEqual({
      name: 'Manual Release – WC Payers',
      description: '',
      is_active: true,
    })
  })

  it('changes status with is_active alone, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Release bucket updated successfully'))
      .mockResolvedValueOnce(done('Release bucket deleted successfully'))
    await setReleaseBucketActive(4, false)
    await expect(deleteReleaseBucket(4)).resolves.toBe('Release bucket deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ is_active: false })
    expect([call(1).init.method, call(1).url]).toEqual(['DELETE', `${BASE}/release-buckets/4`])
  })

  it('puts a taken name on the name field', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The name has already been taken.',
        errors: { name: ['The name has already been taken.'] },
      }),
    )
    const error: unknown = await createReleaseBucket(values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors).toEqual([
      { path: 'name', message: 'The name has already been taken.' },
    ])
  })
})
