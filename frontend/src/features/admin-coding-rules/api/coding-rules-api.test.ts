import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import {
  createCodingRule,
  deleteCodingRule,
  listCodingRules,
  previewCodingRule,
  setCodingRuleActive,
  updateCodingRule,
} from './coding-rules-api'

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

/** Rules in the shape seen on staging (2026-10-20). */
const replaceDefault = {
  id: 1,
  practice_id: 1,
  scope: 'default',
  insurance_id: null,
  insurance: null,
  action: 'replace',
  procedure_code_id: 14,
  procedure_code: { id: 14, code: '97014', description: 'Electrical stimulation' },
  replacement_code_id: 1,
  replacement_code: { id: 1, code: '98110', description: 'Therapeutic exercise' },
  summary: 'Replace 97014 with 98110 for all payers',
  is_active: true,
  notes: 'Payer contract',
  created_at: '2026-10-20T17:44:39.000000Z',
  updated_at: '2026-10-20T17:44:39.000000Z',
}
const dropPayer = {
  ...replaceDefault,
  id: 2,
  scope: 'payer',
  insurance_id: 1,
  insurance: { id: 1, name: 'Corvel Enterprise' },
  action: 'drop',
  replacement_code_id: null,
  replacement_code: null,
  summary: 'Drop 97014 for Corvel Enterprise',
  is_active: false,
  notes: null,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const done = (message: string) => json(200, { success: true, message, data: null })
const page = (data: unknown[], current: number, last: number) => ({
  success: true,
  message: 'Coding rules retrieved successfully',
  data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 100, total: 2 } },
})

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

describe('coding rules against the backend', () => {
  it('reads every page of one practice’s rules', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, page([replaceDefault], 1, 2)))
      .mockResolvedValueOnce(json(200, page([dropPayer], 2, 2)))
    const rules = await listCodingRules(1)
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/coding-rules?page=1&per_page=100&practice_id=1`,
      `${BASE}/coding-rules?page=2&per_page=100&practice_id=1`,
    ])
    expect(rules).toEqual([
      {
        id: 1,
        practiceId: 1,
        type: 'Replace',
        fromCodeId: 14,
        fromCode: '97014',
        toCodeId: 1,
        toCode: '98110',
        scope: { kind: 'default' },
        insuranceName: '',
        note: 'Payer contract',
        isActive: true,
      },
      {
        id: 2,
        practiceId: 1,
        type: 'Drop',
        fromCodeId: 14,
        fromCode: '97014',
        toCodeId: null,
        toCode: '',
        scope: { kind: 'insurance', insuranceId: 1 },
        insuranceName: 'Corvel Enterprise',
        note: '',
        isActive: false,
      },
    ])
  })

  it('creates with POST, saves with PUT, switches with PUT is_active, deletes — in the server’s words', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Coding rule created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Coding rule updated successfully'))
      .mockResolvedValueOnce(done('Coding rule updated successfully'))
      .mockResolvedValueOnce(done('Coding rule deleted successfully'))
    const payload = {
      action: 'replace' as const,
      procedure_code_id: 14,
      replacement_code_id: 1,
      insurance_id: 1,
      notes: null,
    }
    await expect(createCodingRule({ practice_id: 1, ...payload })).resolves.toBe(
      'Coding rule created successfully',
    )
    await expect(updateCodingRule(1, payload)).resolves.toBe('Coding rule updated successfully')
    await setCodingRuleActive(1, false)
    await expect(deleteCodingRule(1)).resolves.toBe('Coding rule deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/coding-rules`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({ practice_id: 1, ...payload })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/coding-rules/1`])
    // The server refuses the practice on a save.
    expect(JSON.parse(call(1).init.body as string)).not.toHaveProperty('practice_id')
    expect(JSON.parse(call(2).init.body as string)).toEqual({ is_active: false })
    expect([call(3).init.method, call(3).url]).toEqual(['DELETE', `${BASE}/coding-rules/1`])
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'There is already a default rule for this code. (and 1 more error)',
        errors: {
          procedure_code_id: ['There is already a default rule for this code.'],
          replacement_code_id: ['A code cannot be replaced with itself.'],
          insurance_id: ['The insurance must belong to the same practice.'],
        },
      }),
    )
    const error: unknown = await createCodingRule({
      practice_id: 1,
      action: 'replace',
      procedure_code_id: 14,
      replacement_code_id: 14,
      insurance_id: 9,
      notes: null,
    }).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'fromCode',
      'toCode',
      'scope',
    ])
  })

  it('previews one code for one insurance: the rule that acts, or none — in the server’s words', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(200, { success: true, message: 'Drop 97014 for Corvel Enterprise', data: dropPayer }),
      )
      .mockResolvedValueOnce(
        json(200, { success: true, message: 'No rule applies: the code is billed as entered', data: null }),
      )
    const acts = await previewCodingRule({ practiceId: 1, insuranceId: 1, procedureCodeId: 14 })
    expect(call(0).url).toBe(`${BASE}/coding-rules/preview?practice_id=1&insurance_id=1&procedure_code_id=14`)
    expect(acts.message).toBe('Drop 97014 for Corvel Enterprise')
    expect(acts.rule).toEqual(expect.objectContaining({ id: 2, type: 'Drop', fromCode: '97014' }))
    await expect(previewCodingRule({ practiceId: 1, insuranceId: 16, procedureCodeId: 1 })).resolves.toEqual({
      message: 'No rule applies: the code is billed as entered',
      rule: null,
    })
  })
})
