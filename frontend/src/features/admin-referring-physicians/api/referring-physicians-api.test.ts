import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import {
  createReferringPhysician,
  listReferringPhysicians,
  updateReferringPhysician,
} from './referring-physicians-api'

const values = { practiceId: '2', code: 'NEW1', name: 'Ada Lin, MD', type: 'DQ', npi: '1386950417' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('referring physicians API without a backend', () => {
  it('answers every call as unavailable instead of inventing an endpoint', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    for (const call of [
      () => listReferringPhysicians(),
      () => createReferringPhysician(values),
      () => updateReferringPhysician(1, values),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

describe('referring physicians API against the development mock', () => {
  it('creates a physician and reads it back in the screen’s shape', async () => {
    const created = await createReferringPhysician(values)
    expect(created).toMatchObject({ practiceId: 2, code: 'NEW1', name: 'Ada Lin, MD', type: 'DQ' })
    const all = await listReferringPhysicians()
    expect(all.some((physician) => physician.id === created.id)).toBe(true)
  })

  it('refuses a code already used in the same practice (V2) as a field error', async () => {
    const error: unknown = await createReferringPhysician({ ...values, code: 'SO01' }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual(['code'])
  })
})
