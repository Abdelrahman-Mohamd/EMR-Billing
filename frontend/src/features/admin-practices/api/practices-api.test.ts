import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { clearSession, setSession } from '@/lib/auth/session'
import type { LocationFormValues, NewPracticeFormValues } from '../schemas/practice-form'
import {
  createLocation,
  createPractice,
  deleteLocation,
  deletePractice,
  getPractice,
  listLocations,
  listPractices,
  setLocationActive,
  updateLocation,
  updatePractice,
} from './practices-api'

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

const location: LocationFormValues = {
  code: 'BR003',
  name: 'Bay Ridge',
  npi: '1234567893',
  address: { line1: '7501 3rd Avenue', city: 'Brooklyn', state: 'NY', zip: '11209' },
  placeOfService: '11',
  isActive: true,
}

/** The confirmed example (2026-10-07), with its first location. */
const practice: NewPracticeFormValues = {
  organizationId: '3',
  code: 'PdVs4',
  name: 'Physical Therapy of The City',
  dbaName: 'City PT',
  npi: '1234567893',
  taxId: '12-3456789',
  taxonomyCode: '225100000X',
  address: { line1: '100 Main Street', line2: 'Suite 200', city: 'Brooklyn', state: 'NY', zip: '11209' },
  isActive: true,
  location,
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setSession({ accessToken: 'test-token-123', tokenType: 'Bearer' })
})
afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
})

describe('creating a practice against the backend', () => {
  it('posts the practice with its first location to /practices, with the session token', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, message: 'Practice created successfully', data: null }),
    )
    await expect(createPractice(practice)).resolves.toBe('Practice created successfully')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe(`${BASE}/practices`)
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token-123')
    expect(JSON.parse(init?.body as string)).toEqual({
      organization_id: 3,
      code: 'PdVs4',
      name: 'Physical Therapy of The City',
      dba_name: 'City PT',
      npi: '1234567893',
      tax_id: '12-3456789',
      taxonomy_code: '225100000X',
      address: { line1: '100 Main Street', line2: 'Suite 200', city: 'Brooklyn', state: 'NY', zip: '11209' },
      is_active: true,
      locations: [
        {
          code: 'BR003',
          name: 'Bay Ridge',
          npi: '1234567893',
          address: '7501 3rd Avenue',
          city: 'Brooklyn',
          state: 'NY',
          zipcode: '11209',
          place_of_service: '11',
        },
      ],
    })
  })

  it('reads only the server message from the answer: none here, so null', async () => {
    fetchMock.mockResolvedValueOnce(json(201, { success: true, data: { anything: 'at all' } }))
    await expect(createPractice(practice)).resolves.toBeNull()
  })

  it('puts the server field errors on the form fields, the first location included', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The tax id field format is invalid. (and 3 more errors)',
        errors: {
          tax_id: ['The tax id field format is invalid.'],
          'address.zip': ['The address.zip field must be 5 digits.'],
          'locations.0.code': ['The location code has already been taken.'],
          'locations.0.address': ['The locations.0.address field is required.'],
          'locations.0.zipcode': ['The locations.0.zipcode field must be 5 digits.'],
          'locations.0.place_of_service': ['The selected place of service is invalid.'],
        },
      }),
    )
    const error: unknown = await createPractice(practice).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('validation')
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'taxId',
      'address.zip',
      'location.code',
      'location.address.line1',
      'location.address.zip',
      'location.placeOfService',
    ])
  })
})

/** A list item in the confirmed shape (2026-10-07). */
const summary = (id: number) => ({
  id,
  organization_id: 3,
  code: `PdVds${id}`,
  name: `Practice ${id}`,
  npi: '1234567893',
  tax_id: '12-3456789',
  taxonomy_code: '225100000X',
  is_active: true,
  organization: { id: 3, name: 'Adam Group', is_active: true, created_at: '2026-10-07T16:51:21.000000Z' },
  locations_count: 2,
  created_at: '2026-10-07T17:24:07.000000Z',
})

const page = (data: unknown[], currentPage: number, lastPage: number) => ({
  success: true,
  message: 'Practices retrieved successfully',
  data: {
    data,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: currentPage,
      from: 1,
      last_page: lastPage,
      links: [],
      path: `${BASE}/practices`,
      per_page: 15,
      to: data.length,
      total: data.length,
    },
  },
})

describe('reading practices from the backend', () => {
  it('lists every page of GET /practices as summaries', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, page([summary(1)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([summary(16)], 2, 2)))
    const all = await listPractices()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/practices?page=1`,
      `${BASE}/practices?page=2`,
    ])
    expect(all[0]).toEqual({
      id: 1,
      organizationId: 3,
      organizationName: 'Adam Group',
      code: 'PdVds1',
      name: 'Practice 1',
      npi: '1234567893',
      taxId: '12-3456789',
      taxonomyCode: '225100000X',
      isActive: true,
      locationsCount: 2,
    })
    expect(all.map((item) => item.id)).toEqual([1, 16])
  })

  it('reads a practice in full with GET /practices/{id}, its flat locations into addresses', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        message: 'Practice retrieved successfully',
        data: {
          ...summary(1),
          dba_name: 'City PT',
          address: {
            zip: '11209',
            city: 'Brooklyn',
            line1: '100 Main Street',
            line2: 'Suite 200',
            state: 'NY',
          },
          locations: [
            {
              id: 1,
              practice_id: 1,
              code: 'BR003',
              name: 'Bay Ridge',
              npi: '1234567893',
              address: '7501 3rd Avenue',
              city: 'Brooklyn',
              state: 'NY',
              zipcode: '11209',
              place_of_service: '11',
              is_active: true,
              created_at: '2026-10-07T17:24:07.000000Z',
              updated_at: '2026-10-07T17:24:07.000000Z',
            },
          ],
        },
      }),
    )
    const result = await getPractice(1)
    expect(fetchMock.mock.calls[0]?.[0] as string).toBe(`${BASE}/practices/1`)
    expect(result).toMatchObject({
      id: 1,
      organizationName: 'Adam Group',
      dbaName: 'City PT',
      address: { line1: '100 Main Street', line2: 'Suite 200', city: 'Brooklyn', state: 'NY', zip: '11209' },
      locations: [
        {
          id: 1,
          practiceId: 1,
          code: 'BR003',
          name: 'Bay Ridge',
          npi: '1234567893',
          address: { line1: '7501 3rd Avenue', city: 'Brooklyn', state: 'NY', zip: '11209' },
          placeOfService: '11',
          isActive: true,
        },
      ],
    })
  })

  it('reads a practice in no organization, with no DBA', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, {
        success: true,
        data: {
          ...summary(2),
          organization_id: null,
          organization: null,
          dba_name: null,
          address: { line1: '1 Main Street', line2: null, city: 'Brooklyn', state: 'NY', zip: '11209' },
          locations: [],
        },
      }),
    )
    const result = await getPractice(2)
    expect(result.organizationId).toBeNull()
    expect(result).not.toHaveProperty('organizationName')
    expect(result.dbaName).toBeUndefined()
    expect(result.address).not.toHaveProperty('line2')
  })
})

describe('saving and deleting a practice against the backend', () => {
  it('saves with PUT /practices/{id}: the practice payload, without its locations', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, message: 'Practice updated successfully', data: null }),
    )
    const { location: _first, ...values } = practice
    await expect(updatePractice(1, values)).resolves.toBe('Practice updated successfully')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe(`${BASE}/practices/1`)
    expect(init?.method).toBe('PUT')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token-123')
    expect(JSON.parse(init?.body as string)).toEqual({
      organization_id: 3,
      code: 'PdVs4',
      name: 'Physical Therapy of The City',
      dba_name: 'City PT',
      npi: '1234567893',
      tax_id: '12-3456789',
      taxonomy_code: '225100000X',
      address: { line1: '100 Main Street', line2: 'Suite 200', city: 'Brooklyn', state: 'NY', zip: '11209' },
      is_active: true,
    })
  })

  it('puts a save rejection on the form fields', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The code has already been taken.',
        errors: { code: ['The code has already been taken.'] },
      }),
    )
    const { location: _first, ...values } = practice
    const error: unknown = await updatePractice(1, values).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors).toEqual([
      { path: 'code', message: 'The code has already been taken.' },
    ])
  })

  it('deletes with DELETE /practices/{id}, sending no body', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, message: 'Practice deleted successfully', data: null }),
    )
    await expect(deletePractice(4)).resolves.toBe('Practice deleted successfully')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe(`${BASE}/practices/4`)
    expect(init?.method).toBe('DELETE')
    expect(init?.body).toBeUndefined()
  })
})

describe('locations against the backend', () => {
  const done = (message: string) => json(200, { success: true, message, data: null })

  it('lists every page of GET /locations as summaries', async () => {
    const item = (id: number) => ({
      id,
      practice_id: 1,
      code: `L${id}`,
      name: `Location ${id}`,
      npi: '1234567893',
      place_of_service: '11',
      is_active: id !== 2,
      practice: { name: 'Physical Therapy of The City' },
      created_at: '2026-10-07T17:24:07.000000Z',
    })
    const page = (data: unknown[], current: number, last: number) => ({
      success: true,
      data: { data, links: {}, meta: { current_page: current, last_page: last, per_page: 15, total: 3 } },
    })
    fetchMock
      .mockResolvedValueOnce(json(200, page([item(1), item(2)], 1, 2)))
      .mockResolvedValueOnce(json(200, page([item(3)], 2, 2)))
    const all = await listLocations()
    expect(fetchMock.mock.calls.map(([url]) => url as string)).toEqual([
      `${BASE}/locations?page=1`,
      `${BASE}/locations?page=2`,
    ])
    expect(all).toEqual([
      { id: 1, practiceId: 1, code: 'L1', name: 'Location 1', isActive: true },
      { id: 2, practiceId: 1, code: 'L2', name: 'Location 2', isActive: false },
      { id: 3, practiceId: 1, code: 'L3', name: 'Location 3', isActive: true },
    ])
  })

  it('adds a location with POST /locations, flat, with its practice', async () => {
    fetchMock.mockResolvedValueOnce(
      json(201, { success: true, message: 'Location created successfully', data: null }),
    )
    await expect(createLocation(1, location)).resolves.toBe('Location created successfully')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url as string).toBe(`${BASE}/locations`)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      practice_id: 1,
      code: 'BR003',
      name: 'Bay Ridge',
      npi: '1234567893',
      address: '7501 3rd Avenue',
      city: 'Brooklyn',
      state: 'NY',
      zipcode: '11209',
      place_of_service: '11',
      is_active: true,
    })
  })

  it('saves with PUT /locations/{id} without practice_id, and changes status with is_active alone', async () => {
    fetchMock
      .mockResolvedValueOnce(done('Location updated successfully'))
      .mockResolvedValueOnce(done('Location updated successfully'))
    await updateLocation(2, location)
    await setLocationActive(2, false)
    const [saveUrl, save] = fetchMock.mock.calls[0] ?? []
    expect([save?.method, saveUrl as string]).toEqual(['PUT', `${BASE}/locations/2`])
    expect(JSON.parse(save?.body as string)).not.toHaveProperty('practice_id')
    expect(JSON.parse(save?.body as string)).toMatchObject({ code: 'BR003', zipcode: '11209' })
    const [, status] = fetchMock.mock.calls[1] ?? []
    expect(status?.method).toBe('PUT')
    expect(JSON.parse(status?.body as string)).toEqual({ is_active: false })
  })

  it('deletes with DELETE /locations/{id}', async () => {
    fetchMock.mockResolvedValueOnce(done('Location deleted successfully'))
    await deleteLocation(2)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect([init?.method, url as string]).toEqual(['DELETE', `${BASE}/locations/2`])
  })

  it('puts the server field errors on the location form', async () => {
    // The answer staging gave to the nested-address example.
    fetchMock.mockResolvedValueOnce(
      json(422, {
        message: 'The address field must be a string. (and 3 more errors)',
        errors: {
          address: ['The address field must be a string.'],
          city: ['The city field is required.'],
          zipcode: ['The zipcode field is required.'],
          code: ['The code has already been taken.'],
        },
      }),
    )
    const error: unknown = await createLocation(1, location).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual([
      'address.line1',
      'address.city',
      'address.zip',
      'code',
    ])
  })
})
