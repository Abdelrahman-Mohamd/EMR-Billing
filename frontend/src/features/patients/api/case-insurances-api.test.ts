import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { newCoverageValues, toCoveragePayload, toCoverageUpdatePayload } from '../schemas/coverage-form'
import {
  createCaseInsurance,
  deleteCaseInsurance,
  listCaseInsurances,
  setCaseInsuranceSubscriber,
  updateCaseInsurance,
} from './case-insurances-api'

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

/** A case insurance in the shape seen on staging (2026-10-08). */
const wire = (id: number) => ({
  id,
  case_id: 21,
  insurance_id: 1,
  rank: 1,
  rank_label: 'Primary',
  member_id: 'XYZ123456789',
  group_number: 'GRP100',
  claim_number: '1439WC260300330',
  subscriber: {
    gender: 'F',
    last_name: 'Doe',
    first_name: 'Mary',
    relationship: 'Spouse',
    date_of_birth: '1980-02-01',
  },
  patient_is_subscriber: false,
  employer: {
    name: 'ACME Construction',
    address: { zip: '11232', city: 'Brooklyn', line1: '5 Industrial Rd', state: 'NY' },
  },
  effective_date: '2026-01-01',
  termination_date: null,
  insurance: {
    id: 1,
    code: 1039,
    name: 'Corvel Enterprise',
    display_name: '1039 – Corvel Enterprise',
    insurance_type: 'WC',
  },
  authorizations: [],
  created_at: '2026-10-08T19:49:57.000000Z',
  updated_at: '2026-10-08T19:49:57.000000Z',
})

const values = {
  ...newCoverageValues('1'),
  insuranceId: '1',
  memberId: 'XYZ123456789',
  groupNumber: 'GRP100',
  claimNumber: '1439WC260300330',
  subscriberRelationship: 'Spouse',
  subscriberFirstName: 'Mary',
  subscriberLastName: 'Doe',
  subscriberDob: '1980-02-01',
  subscriberGender: 'F',
  employerName: 'ACME Construction',
  employerLine1: '5 Industrial Rd',
  employerCity: 'Brooklyn',
  employerState: 'NY',
  employerZip: '11232',
  effectiveDate: '2026-01-01',
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

describe('case insurances against the backend', () => {
  it('reads every page of GET /case-insurances', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16)], 2, 2)))
    const all = await listCaseInsurances()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/case-insurances?page=1&per_page=100`,
      `${BASE}/case-insurances?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all[0]).toEqual({
      id: '1',
      caseId: '21',
      insuranceId: 1,
      insuranceLabel: '1039 – Corvel Enterprise',
      insuranceName: 'Corvel Enterprise',
      insuranceType: 'WC',
      rank: 1,
      rankLabel: 'Primary',
      memberId: 'XYZ123456789',
      groupNumber: 'GRP100',
      claimNumber: '1439WC260300330',
      subscriber: {
        firstName: 'Mary',
        lastName: 'Doe',
        relationship: 'Spouse',
        dob: '1980-02-01',
        gender: 'F',
      },
      employer: {
        name: 'ACME Construction',
        address: { line1: '5 Industrial Rd', city: 'Brooklyn', state: 'NY', zip: '11232' },
      },
      effectiveDate: '2026-01-01',
      terminationDate: '',
    })
  })

  it('adds with POST, with the case and insurance — the contract’s body', async () => {
    fetchMock.mockResolvedValueOnce(
      json(201, { success: true, message: 'Case insurance created successfully', data: null }),
    )
    await expect(createCaseInsurance(toCoveragePayload('21', values))).resolves.toBe(
      'Case insurance created successfully',
    )
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/case-insurances`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({
      case_id: 21,
      insurance_id: 1,
      rank: 1,
      member_id: 'XYZ123456789',
      group_number: 'GRP100',
      claim_number: '1439WC260300330',
      subscriber: {
        first_name: 'Mary',
        last_name: 'Doe',
        relationship: 'Spouse',
        date_of_birth: '1980-02-01',
        gender: 'F',
      },
      employer: {
        name: 'ACME Construction',
        address: { line1: '5 Industrial Rd', city: 'Brooklyn', state: 'NY', zip: '11232' },
      },
      effective_date: '2026-01-01',
      termination_date: null,
    })
  })

  it('saves with PUT without the case or insurance, sets the subscriber alone, and deletes', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Case insurance updated successfully'))
      .mockResolvedValueOnce(done('Case insurance updated successfully'))
      .mockResolvedValueOnce(done('Case insurance deleted successfully'))
    await updateCaseInsurance('3', toCoverageUpdatePayload({ ...values, subscriberRelationship: 'Self' }))
    await setCaseInsuranceSubscriber('3', null)
    await expect(deleteCaseInsurance('3')).resolves.toBe('Case insurance deleted successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['PUT', `${BASE}/case-insurances/3`])
    const save = JSON.parse(call(0).init.body as string) as Record<string, unknown>
    expect(save).not.toHaveProperty('case_id')
    expect(save).not.toHaveProperty('insurance_id')
    // Self: the patient is the subscriber.
    expect(save.subscriber).toBeNull()
    expect(JSON.parse(call(1).init.body as string)).toEqual({ subscriber: null })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/case-insurances/3`])
  })

  it('puts the server field errors on the form fields, the subscriber’s and employer’s included', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'This insurance is already on the case. (and 2 more errors)',
        errors: {
          insurance_id: ['This insurance is already on the case.'],
          'subscriber.relationship': ['The subscriber relationship must be Spouse, Child or Other.'],
          'employer.address.zip': [
            'The employer.address.zip field is required when employer.address is present.',
          ],
        },
      }),
    )
    const error: unknown = await createCaseInsurance(toCoveragePayload('21', values)).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'insuranceId',
      'subscriberRelationship',
      'employerZip',
    ])
  })
})
