import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { createFeeRow, deleteFeeRow, getFeeRow, listFeeRows, updateFeeRow } from './fee-schedules-api'

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

/** A row in the confirmed shape (2026-10-08). */
const wire = (id: number) => ({
  id,
  insurance_id: 1,
  procedure_code_id: 1,
  billed_amount: '30.00',
  effective_from: '2026-01-01',
  effective_to: null,
  insurance: { id: 1, code: 1039, name: 'Corvel Enterprise' },
  procedure_code: { id: 1, code: '98110', description: 'Therapeutic exercise', default_fee: '25.00' },
  created_at: '2026-10-08T16:43:04.000000Z',
  updated_at: '2026-10-08T16:43:04.000000Z',
})

const values = { procedureCodeId: '1', billed: '30', from: '2026-01-01', to: '' }

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

describe('fee schedules against the backend', () => {
  it('reads every page of GET /fee-schedules', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16)], 2, 2)))
    const all = await listFeeRows()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/fee-schedules?page=1`,
      `${BASE}/fee-schedules?page=2`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all.map((row) => [row.id, row.procedureCode, row.billed, row.to])).toEqual([
      [1, '98110', 30, null],
      [16, '98110', 30, null],
    ])
  })

  it('reads one row with GET /fee-schedules/{id}', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: wire(3) }))
    expect(await getFeeRow(3)).toMatchObject({ id: 3, defaultFee: 25 })
    expect(call(0).url).toBe(`${BASE}/fee-schedules/3`)
  })

  it('creates with POST, with the insurance and code; saves with PUT, without them', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Fee schedule created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Fee schedule updated successfully'))
    await expect(createFeeRow(1, values)).resolves.toBe('Fee schedule created successfully')
    await expect(updateFeeRow(3, { ...values, to: '2026-12-31' })).resolves.toBe(
      'Fee schedule updated successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/fee-schedules`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      insurance_id: 1,
      procedure_code_id: 1,
      billed_amount: 30,
      effective_from: '2026-01-01',
      effective_to: null,
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/fee-schedules/3`])
    expect(JSON.parse(call(1).init.body as string)).toEqual({
      billed_amount: 30,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
    })
  })

  it('deletes with DELETE', async () => {
    fetchMock.mockResolvedValueOnce(done('Fee schedule deleted successfully'))
    await expect(deleteFeeRow(3)).resolves.toBe('Fee schedule deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['DELETE', `${BASE}/fee-schedules/3`])
  })

  it('puts the server field errors on the form fields, and keeps an overlap’s message', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(422, {
          message: 'The procedure code must exist and be active. (and 1 more error)',
          errors: {
            procedure_code_id: ['The procedure code must exist and be active.'],
            effective_to: ['The effective to field must be a date after or equal to effective from.'],
          },
        }),
      )
      .mockResolvedValueOnce(
        json(422, {
          success: false,
          message:
            'This insurance already has a price for this code in an overlapping date range. End the current price first.',
          errors: [],
        }),
      )
    const fields: unknown = await createFeeRow(1, values).catch((caught: unknown) => caught)
    expect(isApiError(fields) && fields.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'procedureCodeId',
      'to',
    ])
    const overlap: unknown = await createFeeRow(1, values).catch((caught: unknown) => caught)
    expect(isApiError(overlap) && overlap.serverMessage).toBe(
      'This insurance already has a price for this code in an overlapping date range. End the current price first.',
    )
  })
})
