import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import { newPatientValues } from '../schemas/patient-form'
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  setPatientActive,
  updatePatient,
  updatePatientFields,
} from './patients-api'

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

/** A patient in the confirmed list shape (2026-10-08) — invented. */
const summary = (id: number) => ({
  id,
  practice_id: 1,
  emr_id: 56361649,
  first_name: 'John',
  middle_name: 'A',
  last_name: 'Doe',
  date_of_birth: '1985-04-12',
  gender: 'M',
  gender_label: 'Male',
  ssn: '***-**-6789',
  is_active: true,
  created_at: '2026-10-08T17:30:12.000000Z',
})

const values = {
  ...newPatientValues('1'),
  firstName: 'John',
  lastName: 'Doe',
  dob: '1985-04-12',
  gender: 'M',
  line1: '1 Main St',
  city: 'Brooklyn',
  zip: '11209',
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

describe('patients against the backend', () => {
  it('asks the server to search the roster', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        data: {
          data: [summary(1)],
          links: {},
          meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
        },
      }),
    )
    await listPatients('okonk')
    expect(call(0).url).toBe(`${BASE}/patients?page=1&per_page=100&search=okonk`)
  })

  it('reads every page of GET /patients — with nothing but the page and its size in the URL', async () => {
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 2 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([summary(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([summary(16)], 2, 2)))
    const all = await listPatients()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/patients?page=1&per_page=100`,
      `${BASE}/patients?page=2&per_page=100`,
    ])
    expect(call(0).headers.get('Authorization')).toBe('Bearer test-token-123')
    expect(all.map((patient) => [patient.id, patient.billingId, patient.maskedSsn])).toEqual([
      ['1', 1, '***-**-6789'],
      ['16', 16, '***-**-6789'],
    ])
  })

  it('reads one patient with GET /patients/{id}', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        data: {
          ...summary(1),
          address: '1 Main St',
          address_line2: null,
          city: 'Brooklyn',
          state: 'NY',
          zip_code: '11209',
          phone_home: null,
          phone_cell: '7185550142',
          email: null,
          guarantor: null,
          no_statements: false,
          notes: null,
          cases: [{ id: 1, name: 'Default', is_active: true }],
        },
      }),
    )
    expect(await getPatient('1')).toMatchObject({
      id: '1',
      phoneCell: '7185550142',
      guarantor: null,
      cases: [{ id: '1', name: 'Default', isActive: true }],
    })
    expect(call(0).url).toBe(`${BASE}/patients/1`)
  })

  it('creates with POST, with the practice and a typed SSN; saves with PUT, without either', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(201, { success: true, message: 'Patient created successfully', data: null }),
      )
      .mockResolvedValueOnce(done('Patient updated successfully'))
    await expect(createPatient({ ...values, ssn: '123-45-6789' })).resolves.toBe(
      'Patient created successfully',
    )
    await expect(updatePatient('1', values)).resolves.toBe('Patient updated successfully')
    expect([call(0).init.method, call(0).url]).toEqual(['POST', `${BASE}/patients`])
    const created = JSON.parse(call(0).init.body as string) as Record<string, unknown>
    expect(created).toMatchObject({ practice_id: 1, ssn: '123-45-6789', gender: 'M', zip_code: '11209' })
    expect([call(1).init.method, call(1).url]).toEqual(['PUT', `${BASE}/patients/1`])
    const save = JSON.parse(call(1).init.body as string) as Record<string, unknown>
    // An empty SSN would erase the one on file: it is not sent.
    expect(save).not.toHaveProperty('practice_id')
    expect(save).not.toHaveProperty('ssn')
  })

  it('changes status with is_active alone, fixes only the fields given, and deletes with DELETE', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Patient updated successfully'))
      .mockResolvedValueOnce(done('Patient updated successfully'))
      .mockResolvedValueOnce(done('Patient deleted successfully'))
    await setPatientActive('1', false)
    await updatePatientFields('1', { phone_cell: '7185550177', phone_home: null })
    await expect(deletePatient('1')).resolves.toBe('Patient deleted successfully')
    expect(JSON.parse(call(0).init.body as string)).toEqual({ is_active: false })
    expect(JSON.parse(call(1).init.body as string)).toEqual({ phone_cell: '7185550177', phone_home: null })
    expect([call(2).init.method, call(2).url]).toEqual(['DELETE', `${BASE}/patients/1`])
  })

  it('puts the server field errors on the form fields, the guarantor’s included', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The SSN is not a valid Social Security number. (and 3 more errors)',
        errors: {
          ssn: ['The SSN is not a valid Social Security number.'],
          zip_code: ['The zip code field format is invalid.'],
          'guarantor.last_name': ['The guarantor.last name field is required when guarantor is present.'],
          'guarantor.address.city': [
            'The guarantor.address.city field is required when guarantor.address is present.',
          ],
        },
      }),
    )
    const error: unknown = await createPatient(values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'ssn',
      'zip',
      'guarantorLastName',
      'guarantorCity',
    ])
  })
})
