import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import {
  createPatientCase,
  deletePatientCase,
  listPatientCases,
  updatePatientCase,
  updatePatientCaseFields,
} from './patient-cases-api'

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

/** A case in the shape seen on staging (2026-10-08; its diagnoses as of 2026-10-20). */
const wire = (id: number) => ({
  id,
  patient_id: 3,
  name: 'Low back 2026',
  referring_physician_id: 2,
  diagnoses: [
    {
      id: 7,
      case_id: id,
      icd10_code: 'M54.50',
      description: 'Low back pain',
      created_at: '2026-10-20T14:53:23.000000Z',
      updated_at: '2026-10-20T14:53:23.000000Z',
    },
    {
      id: 8,
      case_id: id,
      icd10_code: 'M25.511',
      description: null,
      created_at: '2026-10-20T14:53:23.000000Z',
      updated_at: '2026-10-20T14:53:23.000000Z',
    },
  ],
  injury_type: 'auto',
  injury_type_label: 'Auto Accident',
  injury_date: '2026-06-01',
  start_of_care: '2026-07-10',
  discharge_date: null,
  accident_state: 'NY',
  is_active: true,
  referring_physician: null,
  insurances: [],
  created_at: '2026-10-08T18:23:03.000000Z',
  updated_at: '2026-10-08T18:23:03.000000Z',
})

const payload = {
  name: 'Low back 2026',
  referring_physician_id: 2,
  injury_type: 'auto',
  injury_date: '2026-06-01',
  accident_state: 'NY',
  start_of_care: '2026-07-10',
  discharge_date: null,
  is_active: true,
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

describe('patient cases against the backend', () => {
  it('reads every page of GET /patient-cases', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([wire(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([wire(16)], 2, 2)))
    const all = await listPatientCases()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/patient-cases?page=1&per_page=100`,
      `${BASE}/patient-cases?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all[0]).toEqual({
      id: '1',
      patientId: '3',
      name: 'Low back 2026',
      referrerId: 2,
      diagnoses: [
        { id: '7', code: 'M54.50', description: 'Low back pain' },
        { id: '8', code: 'M25.511', description: '' },
      ],
      injuryType: 'auto',
      injuryTypeLabel: 'Auto Accident',
      injuryDate: '2026-06-01',
      startOfCare: '2026-07-10',
      dischargeDate: '',
      accidentState: 'NY',
      isActive: true,
    })
  })

  it('creates with POST, with the patient; saves with PUT, without it', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Patient case created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Patient case updated successfully'))
    await expect(createPatientCase({ patient_id: 3, ...payload })).resolves.toBe(
      'Patient case created successfully',
    )
    await expect(updatePatientCase('2', payload)).resolves.toBe('Patient case updated successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/patient-cases`])
    expect(JSON.parse(call(0).init.body as string)).toEqual({ patient_id: 3, ...payload })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/patient-cases/2`])
    expect(JSON.parse(call(1).init.body as string)).not.toHaveProperty('patient_id')
  })

  it('saves a fix’s fields alone, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Patient case updated successfully'))
      .mockResolvedValueOnce(done('Patient case deleted successfully'))
    await updatePatientCaseFields('2', { injury_date: '2026-09-01' })
    await expect(deletePatientCase('3')).resolves.toBe('Patient case deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ injury_date: '2026-09-01' })
    expect([call(1).init.method, call(1).url]).toEqual(['DELETE', `${BASE}/patient-cases/3`])
  })

  it('puts the server field errors on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message:
          'The referring physician must be an active physician of the patient’s practice. (and 2 more errors)',
        errors: {
          referring_physician_id: [
            'The referring physician must be an active physician of the patient’s practice.',
          ],
          accident_state: ['The accident state is required for an auto accident (CMS-1500 Box 10b).'],
          name: ['The name has already been taken.'],
        },
      }),
    )
    const error: unknown = await createPatientCase({ patient_id: 3, ...payload }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'referrerId',
      'accidentState',
      'name',
    ])
  })
})
