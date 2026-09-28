import { describe, expect, it } from 'vitest'
import { referringPhysicianFormSchema, toReferringPhysicianPayload } from './referring-physician'

describe('referring physician payload', () => {
  it('is exactly { practice_id, code, name, type, npi }, with the chosen practice as a number', () => {
    // The example payload's shape, with its values substituted by the form's.
    expect(
      toReferringPhysicianPayload({
        practiceId: '3',
        code: '3VY',
        name: 'Demetrios Mikelis',
        type: 'DN',
        npi: '1447694153',
      }),
    ).toStrictEqual({ practice_id: 3, code: '3VY', name: 'Demetrios Mikelis', type: 'DN', npi: '1447694153' })
  })
})

describe('referring physician form', () => {
  const valid = { practiceId: '1', code: 'PN01', name: 'Priya Natarajan, MD', type: 'DN', npi: '1720394851' }

  it('requires every field', () => {
    const result = referringPhysicianFormSchema.safeParse({
      practiceId: null,
      code: ' ',
      name: '',
      type: null,
      npi: '',
    })
    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((issue) => issue.message)
    expect(messages).toEqual(
      expect.arrayContaining([
        'Select a practice.',
        'Enter the code.',
        'Enter the physician name.',
        'Select a type.',
        'Enter the NPI.',
      ]),
    )
  })

  it('accepts a ten-digit NPI and refuses other formats and the dummy NPIs', () => {
    expect(referringPhysicianFormSchema.safeParse(valid).success).toBe(true)
    for (const npi of ['12345', '12345678901', 'abcdefghij', '9999999999', '1234567890']) {
      expect(referringPhysicianFormSchema.safeParse({ ...valid, npi }).success).toBe(false)
    }
  })
})
