import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { newProcedureCodeValues } from '../schemas/procedure-code-form'
import {
  createProcedureCode,
  deleteProcedureCode,
  getProcedureCode,
  listProcedureCodes,
  setProcedureCodeActive,
  setProcedureCodeDefaultFee,
  updateProcedureCode,
} from './procedure-codes-api'

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

/** A code in the confirmed shape (2026-10-08). */
const wire = (id: number, code: string) => ({
  id,
  code,
  description: 'Therapeutic exercise',
  is_timed: false,
  modifier_override: true,
  modifiers: ['GP', 'KX'],
  default_fee: '25.00',
  procedure_type: 'therapeutic',
  procedure_type_label: 'Therapeutic',
  is_active: true,
  created_at: '2026-10-08T15:26:38.000000Z',
  updated_at: '2026-10-08T15:26:38.000000Z',
})

const values = {
  ...newProcedureCodeValues(),
  code: '98110',
  description: 'Therapeutic exercise',
  defaultFee: '25.00',
  modifierOverride: true,
  modifiers: ['GP', 'KX', '', ''],
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

describe('procedure codes against the backend', () => {
  it('reads every page of GET /procedure-codes', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1, '98110')], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16, '97110')], 2, 2)))
    const all = await listProcedureCodes()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/procedure-codes?page=1`,
      `${BASE}/procedure-codes?page=2`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all.map((code) => [code.id, code.code, code.defaultFee])).toEqual([
      [1, '98110', 25],
      [16, '97110', 25],
    ])
  })

  it('reads one code with GET /procedure-codes/{id}', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: wire(1, '98110') }))
    expect(await getProcedureCode(1)).toMatchObject({ id: 1, code: '98110', modifiers: ['GP', 'KX'] })
    expect(call(0).url).toBe(`${BASE}/procedure-codes/1`)
  })

  it('creates with POST and saves with PUT, the whole code', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Procedure code created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Procedure code updated successfully'))
    await expect(createProcedureCode(values)).resolves.toBe('Procedure code created successfully')
    await expect(updateProcedureCode(1, { ...values, isTimed: true })).resolves.toBe(
      'Procedure code updated successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/procedure-codes`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      code: '98110',
      description: 'Therapeutic exercise',
      procedure_type: 'therapeutic',
      is_timed: false,
      modifier_override: true,
      modifiers: ['GP', 'KX'],
      default_fee: 25,
      is_active: true,
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/procedure-codes/1`])
    expect(JSON.parse(call(1).init.body as string)).toMatchObject({ is_timed: true })
  })

  it('changes status with is_active alone, the default fee alone, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Procedure code updated successfully'))
      .mockResolvedValueOnce(done('Procedure code updated successfully'))
      .mockResolvedValueOnce(done('Procedure code deleted successfully'))
    await setProcedureCodeActive(1, false)
    await setProcedureCodeDefaultFee(1, 42.5)
    await expect(deleteProcedureCode(1)).resolves.toBe('Procedure code deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ is_active: false })
    expect(JSON.parse(call(1).init.body as string)).toEqual({ default_fee: 42.5 })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/procedure-codes/1`])
  })

  it('puts the server field errors on the form fields, modifiers on their inputs', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message:
          'The code must be a CPT code (e.g. 97110, 0001F) or an HCPCS code (e.g. E0114). (and 3 more errors)',
        errors: {
          code: ['The code must be a CPT code (e.g. 97110, 0001F) or an HCPCS code (e.g. E0114).'],
          default_fee: ['The default fee field must be at least 0.'],
          modifiers: ['Add at least one modifier when modifier override is on.'],
          'modifiers.1': ['Each modifier must be 2 letters or digits, e.g. GP or 59.'],
        },
      }),
    )
    const error: unknown = await createProcedureCode(values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'code',
      'defaultFee',
      'modifiers.0',
      'modifiers.1',
    ])
  })
})
