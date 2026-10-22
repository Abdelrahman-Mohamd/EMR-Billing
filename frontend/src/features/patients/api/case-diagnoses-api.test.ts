import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { createCaseDiagnosis, deleteCaseDiagnosis, updateCaseDiagnosis } from './case-diagnoses-api'

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

describe('case diagnoses against the backend', () => {
  it('adds with POST, with the case; saves with PUT, without it; deletes — in the server’s words', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Case diagnosis created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Case diagnosis updated successfully'))
      .mockResolvedValueOnce(done('Case diagnosis deleted successfully'))
    await expect(
      createCaseDiagnosis({ case_id: 1, icd10_code: 'M54.2', description: 'Cervicalgia' }),
    ).resolves.toBe('Case diagnosis created successfully')
    await expect(updateCaseDiagnosis('5', { icd10_code: 'M54.2', description: null })).resolves.toBe(
      'Case diagnosis updated successfully',
    )
    await expect(deleteCaseDiagnosis('5')).resolves.toBe('Case diagnosis deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/case-diagnoses`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      case_id: 1,
      icd10_code: 'M54.2',
      description: 'Cervicalgia',
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/case-diagnoses/5`])
    expect(JSON.parse(call(1).init.body as string)).toEqual({ icd10_code: 'M54.2', description: null })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/case-diagnoses/5`])
  })

  it('puts the code’s refusal on the code field, and keeps one with no field as the message', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(422, {
          message: 'This diagnosis is already on the case.',
          errors: { icd10_code: ['This diagnosis is already on the case.'] },
        }),
      )
      .mockResolvedValueOnce(
        json(422, { message: 'A case can have at most 12 diagnosis codes.', errors: [] }),
      )
    const duplicate: unknown = await createCaseDiagnosis({
      case_id: 1,
      icd10_code: 'M54.2',
      description: null,
    }).catch((caught: unknown) => caught)
    expect(isApiError(duplicate) && duplicate.fieldErrors).toEqual([
      { path: 'code', message: 'This diagnosis is already on the case.' },
    ])
    const full: unknown = await createCaseDiagnosis({
      case_id: 1,
      icd10_code: 'M54.5',
      description: null,
    }).catch((caught: unknown) => caught)
    expect(isApiError(full) && [full.serverMessage, full.fieldErrors]).toEqual([
      'A case can have at most 12 diagnosis codes.',
      [],
    ])
  })
})
