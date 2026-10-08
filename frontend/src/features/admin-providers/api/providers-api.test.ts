import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { NEW_PROVIDER_VALUES } from '../schemas/provider'
import {
  correctProviderNpi,
  createProvider,
  deleteProvider,
  getProvider,
  listProviders,
  setProviderActive,
  updateProvider,
} from './providers-api'

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

/** A provider in the confirmed shape (2026-10-08). */
const wire = (id: number) => ({
  id,
  practice_id: 1,
  code: '297',
  first_name: 'Mina',
  last_name: 'Shehata',
  type: 'rendering',
  type_label: 'Rendering',
  credential: 'PT',
  specialty: 'PHYSICAL THERAPIST',
  npi: '1234567893',
  taxonomy_code: '225100000X',
  state_license: 'NY123456',
  is_active: true,
  practice: { id: 1, name: 'Physical Therapy of The City' },
  created_at: '2026-10-08T14:35:58.000000Z',
})

const values = {
  ...NEW_PROVIDER_VALUES,
  practiceId: '1',
  firstName: 'Mina',
  lastName: 'Shehata',
  credential: 'PT',
  code: '297',
  npi: '1234567893',
  stateLicense: 'NY123456',
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

describe('providers against the backend', () => {
  it('reads every page of GET /providers', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16)], 2, 2)))
    const all = await listProviders()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/providers?page=1`,
      `${BASE}/providers?page=2`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all.map((provider) => [provider.id, provider.typeLabel, provider.practiceName])).toEqual([
      [1, 'Rendering', 'Physical Therapy of The City'],
      [16, 'Rendering', 'Physical Therapy of The City'],
    ])
  })

  it('reads one provider with GET /providers/{id}', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: wire(1) }))
    expect(await getProvider(1)).toMatchObject({ id: 1, code: '297', firstName: 'Mina' })
    expect(call(0).url).toBe(`${BASE}/providers/1`)
  })

  it('creates with POST, with the practice; saves with PUT, without it', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Provider created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Provider updated successfully'))
    await expect(createProvider(values)).resolves.toBe('Provider created successfully')
    await expect(updateProvider(1, { ...values, type: 'billing' })).resolves.toBe(
      'Provider updated successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/providers`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      practice_id: 1,
      code: '297',
      first_name: 'Mina',
      last_name: 'Shehata',
      type: 'rendering',
      credential: 'PT',
      specialty: 'PHYSICAL THERAPIST',
      npi: '1234567893',
      taxonomy_code: '225100000X',
      state_license: 'NY123456',
      is_active: true,
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/providers/1`])
    const save = JSON.parse(call(1).init.body as string) as Record<string, unknown>
    expect(save).not.toHaveProperty('practice_id')
    expect(save.type).toBe('billing')
  })

  it('changes status with is_active alone, corrects the NPI alone, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Provider updated successfully'))
      .mockResolvedValueOnce(done('Provider updated successfully'))
      .mockResolvedValueOnce(done('Provider deleted successfully'))
    await setProviderActive(1, false)
    await correctProviderNpi(1, '1497061528')
    await expect(deleteProvider(1)).resolves.toBe('Provider deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ is_active: false })
    expect(JSON.parse(call(1).init.body as string)).toEqual({ npi: '1497061528' })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/providers/1`])
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The code has already been taken. (and 1 more error)',
        errors: {
          code: ['The code has already been taken.'],
          taxonomy_code: [
            'The taxonomy code must be a 10-character provider taxonomy code, e.g. 225100000X.',
          ],
        },
      }),
    )
    const error: unknown = await createProvider(values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'code',
      'taxonomyCode',
    ])
  })
})
