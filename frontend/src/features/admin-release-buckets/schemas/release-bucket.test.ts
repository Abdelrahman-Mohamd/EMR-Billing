import { describe, expect, it } from 'vitest'
import {
  releaseBucketFormSchema,
  releaseBucketResponseSchema,
  toReleaseBucketPayload,
} from './release-bucket'

describe('release bucket payload', () => {
  it('is exactly { practice_id, name, description }, with the chosen practice’s id', () => {
    const values = releaseBucketFormSchema.parse({
      practiceId: '3',
      name: ' Manual Release – WC Payers ',
      description: "Workers' comp payers reviewed before sending",
    })
    expect(toReleaseBucketPayload(values)).toEqual({
      practice_id: 3,
      name: 'Manual Release – WC Payers',
      description: "Workers' comp payers reviewed before sending",
    })
  })

  it('sends an empty description as an empty string', () => {
    expect(
      toReleaseBucketPayload(
        releaseBucketFormSchema.parse({ practiceId: '1', name: 'Hold', description: '' }),
      ),
    ).toEqual({ practice_id: 1, name: 'Hold', description: '' })
  })

  it('requires a practice and a name, and nothing else', () => {
    const result = releaseBucketFormSchema.safeParse({ practiceId: null, name: '  ', description: '' })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Select a practice.',
      'Enter the bucket name.',
    ])
  })

  it('reads a response as its payload plus an id, a missing description as empty', () => {
    expect(
      releaseBucketResponseSchema.parse({ id: 9, practice_id: 2, name: 'Hold', description: null }),
    ).toEqual({ id: 9, practiceId: 2, name: 'Hold', description: '' })
  })
})
