import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, setSession } from '@/lib/auth/session'
import {
  deleteBillingException,
  getExceptionGroups,
  listBillingExceptions,
  reprocessBillingException,
  scanPractice,
} from './billing-exceptions-api'

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

/** An exception in the shape seen on staging (2026-10-20). */
const wire = {
  id: 39,
  practice_id: 1,
  type: 'charge',
  reason: 'zero_amount',
  message: 'Line 97012 is charged at $0.00.',
  patient_id: 11,
  case_id: 11,
  visit_id: 26,
  charge_line_id: 55,
  patient: { id: 11, first_name: 'Adam', last_name: 'Ahmed' },
  visit: { id: 26, date_of_service: '2026-10-09' },
  created_at: '2026-10-20T18:23:13.000000Z',
  updated_at: '2026-10-20T18:23:13.000000Z',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()
const call = (index: number) => {
  const [url, init] = fetchMock.mock.calls[index] ?? []
  // The client always sends a string URL and a JSON string body.
  return { url: url as string, init: init ?? {} }
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

describe('billing exceptions against the backend', () => {
  it('reads every page the filter asks for, as the screens see them', async () => {
    const page = (current: number) => ({
      success: true,
      data: {
        data: [wire],
        links: {},
        meta: { current_page: current, last_page: 2, per_page: 100, total: 2 },
      },
    })
    fetchMock.mockResolvedValueOnce(json(200, page(1))).mockResolvedValueOnce(json(200, page(2)))
    const all = await listBillingExceptions({ practiceId: 1, type: 'charge', reason: 'zero_amount' })
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/billing-exceptions?page=1&per_page=100&practice_id=1&type=charge&reason=zero_amount`,
      `${BASE}/billing-exceptions?page=2&per_page=100&practice_id=1&type=charge&reason=zero_amount`,
    ])
    expect(all[0]).toEqual({
      id: 39,
      practiceId: 1,
      type: 'charge',
      level: 'Charge',
      reason: 'zero_amount',
      trigger: 'Charged at $0.00',
      detail: 'Line 97012 is charged at $0.00.',
      patientId: '11',
      patientFirstName: 'Adam',
      patientLastName: 'Ahmed',
      caseId: '11',
      visitId: 26,
      visitDate: '2026-10-09',
      chargeLineId: 55,
      detectedAt: '2026-10-20T18:23:13.000000Z',
    })
  })

  it('names a type or reason it does not know as sent, rather than failing the list', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        data: {
          data: [{ ...wire, type: 'payment', reason: 'unmapped_remit', patient: null, visit: null }],
          links: {},
          meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
        },
      }),
    )
    const [item] = await listBillingExceptions()
    expect(item).toEqual(expect.objectContaining({ level: 'Payment', trigger: 'Unmapped remit' }))
  })

  it('reads the grouped queue', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        message: 'Billing exceptions retrieved successfully',
        data: {
          total: 3,
          types: [
            {
              type: 'case',
              total: 3,
              reasons: [
                {
                  reason: 'missing_employer',
                  message: 'The Workers’ Comp coverage has no employer.',
                  total: 1,
                },
                { reason: 'no_primary_insurance', message: 'The case has no primary insurance.', total: 2 },
              ],
            },
          ],
        },
      }),
    )
    const groups = await getExceptionGroups({ practiceId: 1 })
    expect(call(0).url).toBe(`${BASE}/billing-exceptions/grouped?practice_id=1`)
    expect(groups).toEqual({
      total: 3,
      types: [
        {
          type: 'case',
          total: 3,
          reasons: [
            { reason: 'missing_employer', total: 1 },
            { reason: 'no_primary_insurance', total: 2 },
          ],
        },
      ],
    })
  })

  it('scans a practice, re-checks one, and deletes one — in the server’s words', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          success: true,
          message: 'Practice re-checked for billing exceptions',
          data: { patients: 3, cases: 3, visits: 1, exceptions: 8 },
        }),
      )
      .mockResolvedValueOnce(
        json(200, {
          success: true,
          message: 'The problem is still there; fix the data and reprocess again',
          data: wire,
        }),
      )
      .mockResolvedValueOnce(
        json(200, { success: true, message: 'Fixed: the exception is cleared', data: null }),
      )
      .mockResolvedValueOnce(json(200, { success: true, message: 'Billing exception removed', data: null }))
    await expect(scanPractice(1)).resolves.toEqual({
      message: 'Practice re-checked for billing exceptions',
      counts: { patients: 3, cases: 3, visits: 1, exceptions: 8 },
    })
    await expect(reprocessBillingException(39)).resolves.toEqual({
      message: 'The problem is still there; fix the data and reprocess again',
      stillThere: true,
    })
    await expect(reprocessBillingException(39)).resolves.toEqual({
      message: 'Fixed: the exception is cleared',
      stillThere: false,
    })
    await expect(deleteBillingException(39)).resolves.toBe('Billing exception removed')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/billing-exceptions/scan`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({ practice_id: 1 })
    expect([call(1).init.method, call(1).url]).toEqual(['POST', `${BASE}/billing-exceptions/39/reprocess`])
    expect([call(3).init.method, call(3).url]).toEqual(['DELETE', `${BASE}/billing-exceptions/39`])
  })
})
