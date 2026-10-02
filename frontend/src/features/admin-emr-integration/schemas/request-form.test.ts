import { describe, expect, it } from 'vitest'
import { requestFormSchema } from './request-form'

const schema = requestFormSchema((id) => id === 'EMR-LOC-4471')
const messages = (values: unknown) => {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('the Request integration form', () => {
  it('asks for the Unique Location ID', () => {
    expect(messages({ uniqueLocationId: '  ', note: '' })).toEqual(['Enter the Unique Location ID.'])
  })

  it('refuses an id another location holds', () => {
    expect(messages({ uniqueLocationId: ' EMR-LOC-4471 ', note: '' })).toEqual([
      'This ID is already linked to another location.',
    ])
  })

  it('accepts a new id, with or without a note', () => {
    expect(schema.parse({ uniqueLocationId: ' EMR-LOC-4490 ', note: ' Opens in May ' })).toEqual({
      uniqueLocationId: 'EMR-LOC-4490',
      note: 'Opens in May',
    })
    expect(messages({ uniqueLocationId: 'EMR-LOC-4490', note: '' })).toEqual([])
  })
})
