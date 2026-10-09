import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import {
  newAuthorizationValues,
  toAuthorizationPayload,
  toAuthorizationUpdatePayload,
} from '../schemas/authorization-form'
import {
  createAuthorization,
  deleteAuthorization,
  listAuthorizations,
  updateAuthorization,
} from './authorizations-api'

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

/** An authorization in the shape seen on staging (2026-10-09). */
const wire = (id: number) => ({
  id,
  case_insurance_id: 13,
  number: '0VJL671TT',
  start_date: '2026-07-10',
  end_date: '2026-09-07',
  authorized_qty: 6,
  used_qty: 2,
  remaining_qty: 4,
  unit: 'visits',
  is_usable_today: false,
  insurance: { id: 1, display_name: '1039 – Corvel Enterprise', rank: 1 },
  created_at: '2026-10-09T15:35:48.000000Z',
  updated_at: '2026-10-09T15:35:48.000000Z',
})

const values = {
  ...newAuthorizationValues('13'),
  number: '0VJL671TT',
  start: '2026-07-10',
  end: '2026-09-07',
  qty: '6',
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

describe('authorizations against the backend', () => {
  it('reads every page of GET /authorizations', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([{ ...wire(16), unit: 'units' }], 2, 2)))
    const all = await listAuthorizations()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/authorizations?page=1`,
      `${BASE}/authorizations?page=2`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all).toEqual([
      {
        id: '1',
        coverageId: '13',
        insuranceName: '1039 – Corvel Enterprise',
        number: '0VJL671TT',
        start: '2026-07-10',
        end: '2026-09-07',
        qty: 6,
        unit: 'visits',
        used: 2,
        remaining: 4,
      },
      expect.objectContaining({ id: '16', unit: 'units' }),
    ])
  })

  it('adds with POST, with its case insurance — the contract’s body', async () => {
    fetchMock.mockResolvedValueOnce(
      json(201, { success: true, message: 'Authorization created successfully', data: null }),
    )
    await expect(createAuthorization(toAuthorizationPayload(values))).resolves.toBe(
      'Authorization created successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/authorizations`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      case_insurance_id: 13,
      number: '0VJL671TT',
      start_date: '2026-07-10',
      end_date: '2026-09-07',
      authorized_qty: 6,
      unit: 'visits',
    })
  })

  it('saves with PUT without the case insurance, and deletes', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Authorization updated successfully'))
      .mockResolvedValueOnce(done('Authorization deleted successfully'))
    await expect(
      updateAuthorization('2', toAuthorizationUpdatePayload({ ...values, unit: 'units' })),
    ).resolves.toBe('Authorization updated successfully')
    await expect(deleteAuthorization('2')).resolves.toBe('Authorization deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['PUT', `${BASE}/authorizations/2`])
    const save = JSON.parse(call(0).init.body as string) as Record<string, unknown>
    // The server refuses the case insurance on a save.
    expect(save).not.toHaveProperty('case_insurance_id')
    expect(save.unit).toBe('units')
    expect([call(1).init.method, call(1).url]).toEqual(['DELETE', `${BASE}/authorizations/2`])
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'This authorization number is already on this insurance. (and 2 more errors)',
        errors: {
          number: ['This authorization number is already on this insurance.'],
          end_date: ['The end date field must be a date after or equal to start date.'],
          authorized_qty: ['The authorized qty field must not be greater than 9999.'],
        },
      }),
    )
    const error: unknown = await createAuthorization(toAuthorizationPayload(values)).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'number',
      'end',
      'qty',
    ])
  })
})
