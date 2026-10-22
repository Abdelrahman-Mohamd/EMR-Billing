import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import type { InsuranceClassFormValues } from '../schemas/insurance-class'
import {
  createInsuranceClass,
  deleteInsuranceClass,
  getInsuranceClass,
  listInsuranceClasses,
  setInsuranceClassActive,
  updateInsuranceClass,
} from './insurance-classes-api'

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

/** A class in the confirmed shape (2026-10-07). */
const wire = (id: number, code = 'WC') => ({
  id,
  practice_id: 1,
  code,
  name: "Worker's Comp",
  authorization_required: true,
  injury_date_required: true,
  apply_specialty_modifiers: false,
  accept_assignment: true,
  icd_version: 'ICD10',
  is_active: true,
  insurances_count: 3,
  created_at: '2026-10-07T19:48:55.000000Z',
})

const values: InsuranceClassFormValues = {
  practiceId: '1',
  code: 'WC',
  name: "Worker's Comp",
  authorizationRequired: true,
  injuryDateRequired: true,
  applySpecialtyModifiers: false,
  acceptAssignment: true,
  icdVersion: 'ICD10',
  isActive: true,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const done = (message: string) => json(200, { success: true, message, data: null })
const page = (data: unknown[], current: number, last: number) => ({
  success: true,
  data: {
    data,
    links: {},
    meta: { current_page: current, last_page: last, per_page: 15, total: data.length },
  },
})

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

describe('insurance classes against the backend', () => {
  it('reads every page of GET /insurance-classes, with the insurance count', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16, 'COM')], 2, 2)))
    const all = await listInsuranceClasses()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/insurance-classes?page=1&per_page=100`,
      `${BASE}/insurance-classes?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all[0]).toEqual({
      id: 1,
      practiceId: 1,
      code: 'WC',
      name: "Worker's Comp",
      authorizationRequired: true,
      injuryDateRequired: true,
      applySpecialtyModifiers: false,
      acceptAssignment: true,
      icdVersion: 'ICD10',
      isActive: true,
      insurancesCount: 3,
    })
    expect(all.map((item) => item.id)).toEqual([1, 16])
  })

  it('reads one class with GET /insurance-classes/{id}, its practice left aside', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, data: { ...wire(1), practice: { id: 1, name: 'X' } } }),
    )
    expect(await getInsuranceClass(1)).toMatchObject({ id: 1, code: 'WC', insurancesCount: 3 })
    expect(call(0).url).toBe(`${BASE}/insurance-classes/1`)
  })

  it('creates with POST, with its practice; saves with PUT, without it', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Insurance class created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Insurance class updated successfully'))
    await expect(createInsuranceClass(values)).resolves.toBe('Insurance class created successfully')
    await expect(updateInsuranceClass(4, { ...values, code: 'WCX' })).resolves.toBe(
      'Insurance class updated successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/insurance-classes`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      practice_id: 1,
      code: 'WC',
      name: "Worker's Comp",
      authorization_required: true,
      injury_date_required: true,
      apply_specialty_modifiers: false,
      accept_assignment: true,
      icd_version: 'ICD10',
      is_active: true,
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/insurance-classes/4`])
    // The server refuses practice_id on a save: a class never moves.
    expect(JSON.parse(call(1).init.body as string)).not.toHaveProperty('practice_id')
    expect(JSON.parse(call(1).init.body as string)).toMatchObject({ code: 'WCX', is_active: true })
  })

  it('changes status with is_active alone, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Insurance class updated successfully'))
      .mockResolvedValueOnce(done('Insurance class deleted successfully'))
    await setInsuranceClassActive(4, false)
    await expect(deleteInsuranceClass(4)).resolves.toBe('Insurance class deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ is_active: false })
    expect([call(1).init.method, call(1).url]).toEqual(['DELETE', `${BASE}/insurance-classes/4`])
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The code has already been taken. (and 1 more error)',
        errors: {
          code: ['The code has already been taken.'],
          icd_version: ['The selected icd version is invalid.'],
        },
      }),
    )
    const error: unknown = await createInsuranceClass(values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'code',
      'icdVersion',
    ])
  })
})
