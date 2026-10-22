import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import {
  correctReferringPhysicianNpi,
  createReferringPhysician,
  deleteReferringPhysician,
  getReferringPhysician,
  listReferringPhysicians,
  setReferringPhysicianActive,
  updateReferringPhysician,
} from './referring-physicians-api'

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

/** A physician in the confirmed shape (2026-10-08). */
const wire = (id: number) => ({
  id,
  practice_id: 1,
  code: '3VY',
  name: 'Demetrios Mikelis',
  type: 'DN',
  type_label: 'Referring',
  npi: '1447694153',
  phone: null,
  fax: null,
  is_active: true,
  practice: { id: 1 },
  created_at: '2026-10-08T14:14:20.000000Z',
})

const values = {
  practiceId: '1',
  code: '3VY',
  name: 'Demetrios Mikelis',
  type: 'DN',
  npi: '1447694153',
  phone: '',
  fax: '',
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

describe('referring physicians against the backend', () => {
  it('reads every page of GET /referring-physicians', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16)], 2, 2)))
    const all = await listReferringPhysicians()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/referring-physicians?page=1&per_page=100`,
      `${BASE}/referring-physicians?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all.map((physician) => [physician.id, physician.typeLabel])).toEqual([
      [1, 'Referring'],
      [16, 'Referring'],
    ])
  })

  it('reads one physician with GET /referring-physicians/{id}', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: wire(1) }))
    expect(await getReferringPhysician(1)).toMatchObject({ id: 1, code: '3VY' })
    expect(call(0).url).toBe(`${BASE}/referring-physicians/1`)
  })

  it('creates with POST, with the practice; saves with PUT, without it', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Referring physician created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Referring physician updated successfully'))
    await expect(createReferringPhysician(values)).resolves.toBe('Referring physician created successfully')
    await expect(updateReferringPhysician(1, { ...values, phone: '800-555-0199' })).resolves.toBe(
      'Referring physician updated successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/referring-physicians`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      practice_id: 1,
      code: '3VY',
      name: 'Demetrios Mikelis',
      type: 'DN',
      npi: '1447694153',
      phone: null,
      fax: null,
      is_active: true,
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/referring-physicians/1`])
    const save = JSON.parse(call(1).init.body as string) as Record<string, unknown>
    expect(save).not.toHaveProperty('practice_id')
    expect(save.phone).toBe('8005550199')
  })

  it('changes status with is_active alone, corrects the NPI alone, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Referring physician updated successfully'))
      .mockResolvedValueOnce(done('Referring physician updated successfully'))
      .mockResolvedValueOnce(done('Referring physician deleted successfully'))
    await setReferringPhysicianActive(1, false)
    await correctReferringPhysicianNpi(1, '1497061528')
    await expect(deleteReferringPhysician(1)).resolves.toBe('Referring physician deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ is_active: false })
    expect(JSON.parse(call(1).init.body as string)).toEqual({ npi: '1497061528' })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/referring-physicians/1`])
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The code has already been taken. (and 1 more error)',
        errors: {
          code: ['The code has already been taken.'],
          npi: ['The npi has already been taken.'],
        },
      }),
    )
    const error: unknown = await createReferringPhysician(values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'code',
      'npi',
    ])
  })
})
