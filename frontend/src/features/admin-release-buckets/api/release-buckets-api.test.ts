import { afterEach, describe, expect, it, vi } from 'vitest'
import { isApiError } from '@/lib/api/api-error'
import { mockReleaseBucketsApi } from './release-buckets-api.mock'
import { createReleaseBucket, listReleaseBuckets, updateReleaseBucket } from './release-buckets-api'

const values = { practiceId: '2', name: 'Manual Release – Review', description: 'Checked before sending.' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('release buckets API without a backend', () => {
  it('answers every call as unavailable instead of inventing an endpoint', async () => {
    vi.stubGlobal('__MOCK_DATA__', false)
    for (const call of [
      () => listReleaseBuckets(),
      () => createReleaseBucket(values),
      () => updateReleaseBucket(1, values),
    ]) {
      const error: unknown = await call().catch((caught: unknown) => caught)
      expect(isApiError(error) && error.kind).toBe('unavailable')
    }
  })
})

describe('release buckets API against the development mock', () => {
  it('sends the backend exactly { practice_id, name, description } — on create and on update', async () => {
    const create = vi.spyOn(mockReleaseBucketsApi, 'create')
    const update = vi.spyOn(mockReleaseBucketsApi, 'update')
    const created = await createReleaseBucket({ ...values, name: 'Manual Release – Spy' })
    await updateReleaseBucket(created.id, { ...values, name: 'Manual Release – Spy 2', description: '' })
    expect(create).toHaveBeenCalledWith({
      practice_id: 2,
      name: 'Manual Release – Spy',
      description: 'Checked before sending.',
    })
    expect(update).toHaveBeenCalledWith(created.id, {
      practice_id: 2,
      name: 'Manual Release – Spy 2',
      description: '',
    })
    vi.restoreAllMocks()
  })

  it('creates a bucket and reads it back in the screen’s shape', async () => {
    const created = await createReleaseBucket(values)
    expect(created).toMatchObject({
      practiceId: 2,
      name: 'Manual Release – Review',
      description: 'Checked before sending.',
    })
    expect((await listReleaseBuckets()).some((bucket) => bucket.id === created.id)).toBe(true)
  })

  it('refuses a name already used in the same practice (V2) as a field error', async () => {
    const error: unknown = await createReleaseBucket({ ...values, name: 'Manual Release – Northgate' }).catch(
      (caught: unknown) => caught,
    )
    expect(isApiError(error) && error.fieldErrors.map((fieldError) => fieldError.path)).toEqual(['name'])
  })
})
