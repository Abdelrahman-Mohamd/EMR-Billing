import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { toChargeLinePayload, toChargeLineUpdatePayload } from '../schemas/visit-form'
import { addChargeLine, deleteChargeLine, updateChargeLine } from './charge-lines-api'

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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const done = (message: string) => json(200, { success: true, message, data: null })

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

describe('charge lines against the backend', () => {
  it('adds with POST — the contract’s body, with the visit', async () => {
    fetchMock.mockResolvedValueOnce(
      json(201, { success: true, message: 'Charge line created successfully', data: null }),
    )
    await expect(
      addChargeLine(
        toChargeLinePayload(2, {
          procedureCode: '3',
          units: '3',
          modifiers: 'gp',
          diagnosisPointers: ['1'],
          placeOfService: '',
          notes: '',
        }),
      ),
    ).resolves.toBe('Charge line created successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/charge-lines`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      visit_id: 2,
      procedure_code_id: 3,
      units: 3,
      modifiers: ['GP'],
      diagnosis_pointers: [1],
    })
  })

  it('saves with PUT without the visit — the lists even when empty, no notes as none — and deletes', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Charge line updated successfully'))
      .mockResolvedValueOnce(done('Charge line deleted successfully'))
    await expect(
      updateChargeLine(
        4,
        toChargeLineUpdatePayload({
          procedureCode: '3',
          units: '5',
          modifiers: '',
          diagnosisPointers: [],
          placeOfService: '12',
          notes: '',
        }),
      ),
    ).resolves.toBe('Charge line updated successfully')
    await expect(deleteChargeLine(4)).resolves.toBe('Charge line deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['PUT', `${BASE}/charge-lines/4`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      procedure_code_id: 3,
      units: 5,
      modifiers: [],
      diagnosis_pointers: [],
      place_of_service: '12',
      notes: null,
    })
    expect([call(1).init.method, call(1).url]).toEqual(['DELETE', `${BASE}/charge-lines/4`])
  })

  it('puts the server field errors on the line’s fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The units field must not be greater than 99. (and 2 more errors)',
        errors: {
          units: ['The units field must not be greater than 99.'],
          'modifiers.0': ['Each modifier must be 2 letters or digits, e.g. GP or 59.'],
          'diagnosis_pointers.1': ['The diagnosis_pointers.1 field has a duplicate value.'],
        },
      }),
    )
    const error: unknown = await addChargeLine({ visit_id: 2, procedure_code_id: 3, units: 100 }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'units',
      'modifiers',
      'diagnosisPointers',
    ])
  })
})
