import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { createVisit, deleteVisit, getVisit, listVisits, releaseVisit, updateVisit } from './visits-api'

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

/** A visit in the shape seen on staging (2026-10-09), as the list sends it. */
const wire = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  case_id: 32,
  date_of_service: '2026-07-15',
  status: 'review',
  pend_reason: null,
  source: 'manual',
  emr_record_id: null,
  diagnosis_codes: ['M75.101', 'M25.511', 'M54.2'],
  location_id: 1,
  billing_provider_id: 1,
  treating_provider_id: 6,
  authorization_id: null,
  total_amount: '90.00',
  released_at: null,
  patient: { id: 26, first_name: 'Nadia', last_name: 'Uishot', date_of_birth: '1984-06-12' },
  case: { id: 32, name: 'R shoulder 2026', insurances: null },
  location: { id: 1, name: 'Bay Ridge', place_of_service: '11' },
  treating_provider: { id: 6, name: 'Adam Mohamed', npi: '1231312312' },
  charge_lines: [
    {
      id: 1,
      visit_id: id,
      procedure_code_id: 1,
      units: 2,
      amount: '60.00',
      modifiers: [],
      diagnosis_pointers: [1],
      place_of_service: '11',
      notes: null,
      coding_rule_id: null,
      original_procedure_code_id: null,
      created_at: '2026-10-09T16:24:22.000000Z',
      updated_at: '2026-10-09T16:24:22.000000Z',
    },
  ],
  created_at: '2026-10-09T16:24:22.000000Z',
  updated_at: '2026-10-09T16:24:22.000000Z',
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

describe('visits against the backend', () => {
  it('reads every page of GET /visits', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(2, { status: 'released' })], 2, 2)))
    const all = await listVisits()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/visits?page=1&per_page=100`,
      `${BASE}/visits?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all[0]).toEqual({
      id: 1,
      caseId: '32',
      caseName: 'R shoulder 2026',
      patientId: '26',
      patientFirstName: 'Nadia',
      patientLastName: 'Uishot',
      dateOfService: '2026-07-15',
      status: 'review',
      pendReason: '',
      source: 'manual',
      diagnosisCodes: ['M75.101', 'M25.511', 'M54.2'],
      locationId: 1,
      locationName: 'Bay Ridge',
      placeOfService: '11',
      billingProviderId: 1,
      billingProvider: null,
      treatingProviderId: 6,
      treatingProvider: { name: 'Adam Mohamed', npi: '1231312312' },
      authorizationId: null,
      authorization: null,
      totalAmount: '90.00',
      releasedAt: '',
      chargeLines: [
        {
          id: 1,
          visitId: 1,
          procedureCodeId: 1,
          procedureCode: '',
          procedureDescription: '',
          units: 2,
          amount: '60.00',
          modifiers: [],
          diagnosisPointers: [1],
          placeOfService: '11',
          notes: '',
          codingRuleId: null,
          originalProcedureCodeId: null,
        },
      ],
    })
    expect(all[1]?.status).toBe('released')
  })

  it('asks for one case’s visits by its id', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        data: {
          data: [wire(1)],
          links: {},
          meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
        },
      }),
    )
    await listVisits({ caseId: '32' })
    expect(call(0).url).toBe(`${BASE}/visits?page=1&per_page=100&case_id=32`)
  })

  it('reads one visit with GET /visits/{id} — its billing provider, authorization and each line’s code', async () => {
    const detail = wire(1, {
      authorization_id: 16,
      billing_provider: { id: 1, name: 'Mina Shehata', npi: '1234567893' },
      authorization: { id: 16, number: 'VIS-1', start_date: '2026-07-01', end_date: '2026-12-31' },
      claims: [],
    })
    detail.charge_lines = detail.charge_lines.map((item) => ({
      ...item,
      procedure_code: { id: 1, code: '98110', description: 'Therapeutic exercise' },
    }))
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: detail }))
    const visit = await getVisit(1)
    expect(call(0).url).toBe(`${BASE}/visits/1`)
    expect(visit.billingProvider).toEqual({ name: 'Mina Shehata', npi: '1234567893' })
    expect(visit.authorizationId).toBe('16')
    expect(visit.authorization).toEqual({ number: 'VIS-1', start_date: '2026-07-01', end_date: '2026-12-31' })
    expect(visit.chargeLines[0]).toEqual(
      expect.objectContaining({ procedureCode: '98110', procedureDescription: 'Therapeutic exercise' }),
    )
  })

  it('reads what scrubbing did to a line: the coding rule that replaced its code, and the code it had', async () => {
    const [line] = wire(1).charge_lines
    const detail = wire(1, {
      status: 'pended',
      charge_lines: [{ ...line, coding_rule_id: 4, original_procedure_code_id: 14 }],
    })
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: detail }))
    const visit = await getVisit(1)
    expect(visit.chargeLines[0]).toEqual(
      expect.objectContaining({ codingRuleId: 4, originalProcedureCodeId: 14 }),
    )
  })

  it('records with POST, saves with PUT, deletes, and releases — in the server’s words', async () => {
    fetchMock
      .mockResolvedValueOnce(json(201, { success: true, message: 'Visit created successfully', data: null }))
      .mockResolvedValueOnce(done('Visit updated successfully'))
      .mockResolvedValueOnce(done('Visit deleted successfully'))
      .mockResolvedValueOnce(
        json(200, {
          success: true,
          message: 'Visit pended: Corvel Enterprise requires authorization.',
          data: wire(1, { status: 'pended', pend_reason: 'Corvel Enterprise requires authorization.' }),
        }),
      )
    const payload = {
      case_id: 32,
      date_of_service: '2026-07-15',
      location_id: 1,
      billing_provider_id: 1,
      treating_provider_id: 6,
      authorization_id: null,
      diagnosis_codes: ['M75.101', 'M25.511'],
      charge_lines: [{ procedure_code_id: 1, units: 2 }],
    }
    await expect(createVisit(payload)).resolves.toBe('Visit created successfully')
    const { case_id: _case, charge_lines: _lines, ...own } = payload
    await expect(updateVisit(1, own)).resolves.toBe('Visit updated successfully')
    await expect(deleteVisit(1)).resolves.toBe('Visit deleted successfully')
    const released = await releaseVisit(1)
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/visits`])
    expect(JSON.parse(call(0).init.body as string)).toEqual(payload)
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/visits/1`])
    const save = JSON.parse(call(1).init.body as string) as Record<string, unknown>
    // The server refuses the case and the lines on a save.
    expect(save).not.toHaveProperty('case_id')
    expect(save).not.toHaveProperty('charge_lines')
    // The visit's own diagnoses are its to change.
    expect(save.diagnosis_codes).toEqual(['M75.101', 'M25.511'])
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/visits/1`])
    expect([call(3).init.method, call(3).url]).toEqual(['POST', `${BASE}/visits/1/release`])
    expect(released.message).toBe('Visit pended: Corvel Enterprise requires authorization.')
    expect(released.visit).toEqual(
      expect.objectContaining({ status: 'pended', pendReason: 'Corvel Enterprise requires authorization.' }),
    )
  })

  it('puts the server field errors on the form fields, a line’s on its line', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'This case already has a visit on that date. (and 2 more errors)',
        errors: {
          date_of_service: ['This case already has a visit on that date.'],
          'charge_lines.0.units': ['The charge_lines.0.units field must not be greater than 99.'],
          'charge_lines.1.modifiers.0': ['Each modifier must be 2 letters or digits, e.g. GP or 59.'],
          'diagnosis_codes.1': ['Each diagnosis must be a valid ICD-10-CM code, e.g. M54.2.'],
        },
      }),
    )
    const error: unknown = await createVisit({
      case_id: 32,
      date_of_service: '2026-07-15',
      location_id: 1,
      billing_provider_id: 1,
      treating_provider_id: 6,
      authorization_id: null,
      diagnosis_codes: ['M75.101', 'ZZZ'],
      charge_lines: [],
    }).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'dateOfService',
      'lines.0.units',
      'lines.1.modifiers',
      'diagnosisCodes',
    ])
  })
})
