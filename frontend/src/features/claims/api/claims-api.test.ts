import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { createClaim, deleteClaim, listClaims, updateClaim } from './claims-api'

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

/** A claim in the shape seen on staging (2026-10-09), as the list sends it. */
const wire = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  visit_id: 27,
  case_insurance_id: 21,
  referring_physician_id: 1,
  format: '837P',
  status: 'held',
  scrub_errors: [],
  allowed_status_changes: ['scrubbed'],
  total_amount: '90.00',
  sent_date: null,
  clearinghouse_ref: null,
  insurance: {
    id: 1,
    display_name: '1039 – Corvel Enterprise',
    rank: 1,
    rank_label: 'Primary',
    member_id: 'WC-4417260',
  },
  patient: { id: 31, first_name: 'Nadia', last_name: 'Uishot' },
  date_of_service: '2026-06-03',
  charge_lines: null,
  created_at: '2026-10-09T17:29:30.000000Z',
  updated_at: '2026-10-09T17:29:30.000000Z',
  ...extra,
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

describe('claims against the backend', () => {
  it('reads every page of GET /claims', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock.mockResolvedValueOnce(json(200, page([wire(1)], 1, 2))).mockResolvedValueOnce(
      json(
        200,
        page(
          [
            wire(2, {
              status: 'sent',
              allowed_status_changes: ['rejected', 'paid', 'denied'],
              sent_date: '2026-10-09',
              clearinghouse_ref: 'CH-1',
              scrub_errors: ['Missing referring NPI', { message: 'Box 21 is empty' }],
            }),
          ],
          2,
          2,
        ),
      ),
    )
    const all = await listClaims()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/claims?page=1`,
      `${BASE}/claims?page=2`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all[0]).toEqual({
      id: 1,
      visitId: 27,
      coverageId: '21',
      format: '837P',
      status: 'held',
      scrubErrors: [],
      allowedStatusChanges: ['scrubbed'],
      totalAmount: '90.00',
      sentDate: '',
      clearinghouseRef: '',
      insuranceName: '1039 – Corvel Enterprise',
      rankLabel: 'Primary',
      memberId: 'WC-4417260',
      patientId: '31',
      patientFirstName: 'Nadia',
      patientLastName: 'Uishot',
      dateOfService: '2026-06-03',
    })
    // Scrub errors as words, whatever their shape.
    expect(all[1]?.scrubErrors).toEqual(['Missing referring NPI', 'Box 21 is empty'])
    expect(all[1]?.allowedStatusChanges).toEqual(['rejected', 'paid', 'denied'])
  })

  it('bills a visit with POST — the visit and the insurance — saves only what changed, and deletes', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Claim created and scrubbed', data: wire(1) }),
      )
      .mockResolvedValueOnce(done('Claim updated successfully'))
      .mockResolvedValueOnce(done('Claim deleted successfully'))
    await expect(createClaim({ visit_id: 27, case_insurance_id: 21 })).resolves.toBe(
      'Claim created and scrubbed',
    )
    await expect(updateClaim(1, { status: 'scrubbed' })).resolves.toBe('Claim updated successfully')
    await expect(deleteClaim(1)).resolves.toBe('Claim deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/claims`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({ visit_id: 27, case_insurance_id: 21 })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/claims/1`])
    expect(JSON.parse(call(1).init.body as string)).toEqual({ status: 'scrubbed' })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/claims/1`])
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The clearinghouse ref field must not be greater than 50 characters.',
        errors: {
          clearinghouse_ref: ['The clearinghouse ref field must not be greater than 50 characters.'],
        },
      }),
    )
    const error: unknown = await updateClaim(1, { clearinghouse_ref: 'x'.repeat(60) }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'clearinghouseRef',
    ])
  })
})
