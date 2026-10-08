import { describe, expect, it } from 'vitest'
import {
  releaseBucketFormSchema,
  releaseBucketResponseSchema,
  toReleaseBucketPayload,
  toReleaseBucketUpdatePayload,
} from './release-bucket'

describe('release bucket payload', () => {
  it('creates with { practice_id, name, description, is_active }, the chosen practice’s id', () => {
    const values = releaseBucketFormSchema.parse({
      practiceId: '3',
      name: ' Manual Release – WC Payers ',
      description: "Workers' comp payers reviewed before sending",
      isActive: true,
    })
    expect(toReleaseBucketPayload(values)).toEqual({
      practice_id: 3,
      name: 'Manual Release – WC Payers',
      description: "Workers' comp payers reviewed before sending",
      is_active: true,
    })
  })

  it('saves without practice_id, which the server refuses on a save', () => {
    const values = releaseBucketFormSchema.parse({
      practiceId: '3',
      name: 'Hold',
      description: '',
      isActive: false,
    })
    expect(toReleaseBucketUpdatePayload(values)).toEqual({ name: 'Hold', description: '', is_active: false })
  })

  it('sends an empty description as an empty string', () => {
    expect(
      toReleaseBucketPayload(
        releaseBucketFormSchema.parse({ practiceId: '1', name: 'Hold', description: '', isActive: true }),
      ),
    ).toEqual({ practice_id: 1, name: 'Hold', description: '', is_active: true })
  })

  it('requires a practice and a name, and nothing else', () => {
    const result = releaseBucketFormSchema.safeParse({
      practiceId: null,
      name: '  ',
      description: '',
      isActive: true,
    })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Select a practice.',
      'Enter the bucket name.',
    ])
  })

  it('reads a bucket, a missing description as empty', () => {
    expect(
      releaseBucketResponseSchema.parse({
        id: 9,
        practice_id: 2,
        name: 'Hold',
        description: null,
        is_active: true,
        insurances_count: 2,
      }),
    ).toEqual({ id: 9, practiceId: 2, name: 'Hold', description: '', isActive: true, insurancesCount: 2 })
  })
})
