import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import type { LocationFormValues, NewPracticeFormValues } from '../schemas/practice-form'
import {
  createLocation,
  createPractice,
  listPractices,
  updateLocation,
  updatePractice,
} from './practices-api'

const location: LocationFormValues = {
  code: 'QN002',
  name: 'Queens',
  npi: '1122334455',
  address: { line1: '37-02 Main Street', city: 'Flushing', state: 'NY', zip: '11354' },
  placeOfService: null,
  isActive: true,
}

const practice: NewPracticeFormValues = {
  organizationId: null,
  code: 'PdV4',
  name: 'Physical Therapy of The City',
  dbaName: '',
  npi: '1234567893',
  taxId: '12-3456789',
  taxonomyCode: '225100000X',
  address: { line1: '100 Main Street', line2: '', city: 'Brooklyn', state: 'NY', zip: '11209' },
  isActive: true,
  location: { ...location, placeOfService: '11' },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('practices API without a backend', () => {
  it('answers every call as unavailable instead of inventing a request', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    for (const call of [
      () => listPractices(),
      () => createPractice(practice),
      () => updatePractice(1, practice),
      () => createLocation(1, location),
      () => updateLocation(1, 1, location),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

// Against the development mock, which plays the server: the payload goes out,
// wire format comes back and is parsed into what the screens use.
describe('practices API against the development mock', () => {
  it('creates a practice with its first location and reads both back', async () => {
    const created = await createPractice(practice)
    expect(created).toMatchObject({
      name: 'Physical Therapy of The City',
      organizationId: null,
      isActive: true,
    })
    expect(created.dbaName).toBeUndefined()
    expect(created.locations).toEqual([
      expect.objectContaining({
        practiceId: created.id,
        code: 'QN002',
        placeOfService: '11',
        isActive: true,
      }),
    ])

    const all = await listPractices()
    expect(all.find((p) => p.id === created.id)?.locations).toHaveLength(1)
  })

  it('rejects a location code already used in the same practice (V2 §10.2) as a field error', async () => {
    const created = await createPractice(practice)
    const error: unknown = await createLocation(created.id, location).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.kind).toBe('validation')
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual(['code'])
  })
})
