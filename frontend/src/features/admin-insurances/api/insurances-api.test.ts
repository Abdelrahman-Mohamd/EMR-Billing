import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { NEW_INSURANCE_VALUES, type InsuranceFormValues } from '../schemas/insurance'
import {
  createInsurance,
  deleteInsurance,
  getInsurance,
  listInsurances,
  setInsuranceActive,
  updateInsurance,
} from './insurances-api'

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

/** A list item in the confirmed shape (2026-10-08). */
const item = (id: number, code: number) => ({
  id,
  practice_id: 1,
  code,
  name: 'Corvel Enterprise',
  display_name: `${code} – Corvel Enterprise`,
  insurance_type: 'WC',
  insurance_type_label: "Workers' Comp",
  payer_id: 'CORVEL',
  insurance_hold: true,
  authorization_required: null,
  injury_date_required: null,
  apply_specialty_modifiers: null,
  accept_assignment: false,
  audit_required: false,
  is_active: true,
  insurance_class: { id: 1, name: "Worker's Comp" },
  release_bucket: { id: 1, name: 'Manual Release – WC Payers' },
  created_at: '2026-10-08T13:01:21.000000Z',
})

const values: InsuranceFormValues = {
  ...NEW_INSURANCE_VALUES,
  practiceId: '3',
  code: '1039',
  name: 'Corvel Enterprise',
  insuranceClassId: '5',
  insuranceType: 'WC',
  payerId: 'CORVEL',
  portalUser: 'billing@clinic',
  portalPassword: 'secret',
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

describe('insurances against the backend', () => {
  it('reads every page of GET /insurances', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([item(1, 1039)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([item(16, 1040)], 2, 2)))
    const all = await listInsurances()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/insurances?page=1&per_page=100`,
      `${BASE}/insurances?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(
      all.map((insurance) => [insurance.id, insurance.insuranceTypeLabel, insurance.releaseBucketName]),
    ).toEqual([
      [1, "Workers' Comp", 'Manual Release – WC Payers'],
      [16, "Workers' Comp", 'Manual Release – WC Payers'],
    ])
  })

  it('reads one insurance in full with GET /insurances/{id}', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        data: {
          ...item(4, 1039),
          insurance_class_id: 1,
          claim_format: '837P',
          payment_sla_days: null,
          address: 'PO Box 2626',
          address_line2: null,
          city: 'Portland',
          state: 'OR',
          zip_code: '97208',
          phone: '8005550199',
          fax: null,
          icd_version: null,
          effective_rules: { authorization_required: true },
          release_bucket_id: 1,
          portal_url: 'https://portal.corvel.com',
          practice: { id: 1 },
        },
      }),
    )
    const detail = await getInsurance(4)
    expect(call(0).url).toBe(`${BASE}/insurances/4`)
    expect(detail).toMatchObject({
      id: 4,
      insuranceClassId: 1,
      address: { line1: 'PO Box 2626', line2: '', city: 'Portland', state: 'OR', zip: '97208' },
      phone: '8005550199',
      claimFormat: '837P',
      portalUrl: 'https://portal.corvel.com',
    })
    expect(JSON.stringify(detail)).not.toMatch(/portal_?user|password/i)
  })

  it('creates with POST, with the practice and the portal sign-in; saves with PUT, without the practice', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Insurance created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Insurance updated successfully'))
    await expect(createInsurance(values)).resolves.toBe('Insurance created successfully')
    await expect(updateInsurance(4, { ...values, portalUser: '', portalPassword: '' })).resolves.toBe(
      'Insurance updated successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/insurances`])
    expect(JSON.parse(call(0).init.body as string)).toMatchObject({
      practice_id: 3,
      insurance_class_id: 5,
      code: 1039,
      insurance_type: 'WC',
      portal_user: 'billing@clinic',
      portal_password: 'secret',
    })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/insurances/4`])
    const save = JSON.parse(call(1).init.body as string) as Record<string, unknown>
    expect(save).not.toHaveProperty('practice_id')
    // Not typed: the stored portal sign-in stays.
    expect(save).not.toHaveProperty('portal_user')
    expect(save).not.toHaveProperty('portal_password')
  })

  it('changes status with is_active alone, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Insurance updated successfully'))
      .mockResolvedValueOnce(done('Insurance deleted successfully'))
    await setInsuranceActive(4, false)
    await expect(deleteInsurance(4)).resolves.toBe('Insurance deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ is_active: false })
    expect([call(1).init.method, call(1).url]).toEqual(['DELETE', `${BASE}/insurances/4`])
  })

  it('puts the server field errors on the form fields, the flat address included', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The code has already been taken. (and 2 more errors)',
        errors: {
          code: ['The code has already been taken.'],
          zip_code: ['The zip code field format is invalid.'],
          insurance_class_id: ['The insurance class must be an active class of the same practice.'],
        },
      }),
    )
    const error: unknown = await createInsurance(values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'code',
      'address.zip',
      'insuranceClassId',
    ])
  })
})
